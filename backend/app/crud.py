"""All database access for paisa, written directly against asyncpg.

Routers stay thin and call into these functions with a pooled connection
(provided by the `get_conn` dependency). SQL column names match
migrations/001_init.sql exactly; return shapes match app.schemas.

Money rules (from the contract):
  - item_total = sum(items.paid)
  - total_paid = item_total + sum(charges) - sum(discounts)
  - charges are stored separately and NEVER counted toward category spend.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from typing import Any

import asyncpg

from . import categorizer
from .schemas import (
    BudgetIn,
    BudgetOut,
    CategoriesSummary,
    CategorySummary,
    ChargeOut,
    ChargeSummary,
    ChargesSummary,
    ItemOut,
    ItemUpdate,
    OrderListItem,
    OrderOut,
    ParsedOrder,
    WeeklySummary,
)
from .schemas import CATEGORIES

# Charge buckets, in canonical display order.
CHARGE_TYPES = [
    "delivery",
    "handling",
    "platform_fee",
    "packaging",
    "rain_fee",
    "taxes",
    "other",
]


# --------------------------------------------------------------------------- #
# Date helpers                                                                 #
# --------------------------------------------------------------------------- #
def _month_bounds(month: str) -> tuple[date, date]:
    """Return (first_day, last_day) for a "YYYY-MM" string."""
    year, mon = (int(p) for p in month.split("-")[:2])
    first = date(year, mon, 1)
    if mon == 12:
        last = date(year, 12, 31)
    else:
        last = date(year, mon + 1, 1) - timedelta(days=1)
    return first, last


def _to_iso(value: Any) -> str:
    """Render a date/datetime as ISO string; pass through strings."""
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value) if value is not None else ""


def _f(value: Any) -> float:
    """Coerce a numeric/Decimal/None DB value to a float."""
    return float(value) if value is not None else 0.0


# --------------------------------------------------------------------------- #
# Orders: create / read / list / delete                                        #
# --------------------------------------------------------------------------- #
async def create_order(conn: asyncpg.Connection, order: ParsedOrder) -> OrderOut:
    """Persist an order + its items + non-zero charges atomically.

    Totals are recomputed from the contract formulas (never trusted blindly).
    Any item category the user set is also stored as a learned correction so
    future auto-tagging improves.
    """
    item_total = round(sum(i.paid for i in order.items), 2)
    charge_sum = round(
        order.charges.delivery
        + order.charges.handling
        + order.charges.platform_fee
        + order.charges.packaging
        + order.charges.rain_fee
        + order.charges.taxes
        + order.charges.other,
        2,
    )
    disc_sum = round(
        order.discounts.coupon + order.discounts.membership + order.discounts.other, 2
    )
    total_paid = round(item_total + charge_sum - disc_sum, 2)

    source = order.source if order.source in ("pdf", "image", "manual") else "manual"
    order_date = _parse_date(order.date)

    order_uuid = uuid.uuid4()

    async with conn.transaction():
        await conn.execute(
            """
            INSERT INTO orders
                (id, platform, date, order_id, item_total, total_paid, source, note)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            order_uuid,
            order.platform,
            order_date,
            order.order_id,
            item_total,
            total_paid,
            source,
            order.note,
        )

        for item in order.items:
            await conn.execute(
                """
                INSERT INTO items
                    (order_id, name, mrp, discount, paid, category)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                order_uuid,
                item.name,
                item.mrp,
                item.discount,
                item.paid,
                item.category,
            )
            # Persist the (name -> category) decision for future auto-tagging.
            await categorizer.record_correction(conn, item.name, item.category)

        charges_map = order.charges.model_dump()
        for ctype in CHARGE_TYPES:
            amount = round(float(charges_map.get(ctype, 0) or 0), 2)
            if amount != 0:
                await conn.execute(
                    "INSERT INTO charges (order_id, type, amount) VALUES ($1, $2, $3)",
                    order_uuid,
                    ctype,
                    amount,
                )

    created = await get_order(conn, str(order_uuid))
    if created is None:  # we just inserted it — should never happen
        raise RuntimeError(f"Order {order_uuid} vanished immediately after insert")
    return created


async def get_order(conn: asyncpg.Connection, order_id: str) -> OrderOut | None:
    """Fetch one order with its items and charges, or None if missing."""
    oid = _as_uuid(order_id)
    if oid is None:
        return None

    row = await conn.fetchrow("SELECT * FROM orders WHERE id = $1", oid)
    if row is None:
        return None

    item_rows = await conn.fetch(
        "SELECT * FROM items WHERE order_id = $1 ORDER BY name", oid
    )
    charge_rows = await conn.fetch(
        "SELECT * FROM charges WHERE order_id = $1", oid
    )

    return OrderOut(
        id=str(row["id"]),
        platform=row["platform"],
        date=_to_iso(row["date"]),
        order_id=row["order_id"],
        item_total=_f(row["item_total"]),
        total_paid=_f(row["total_paid"]),
        source=row["source"],
        note=row["note"],
        created_at=_to_iso(row["created_at"]),
        items=[
            ItemOut(
                id=str(ir["id"]),
                order_id=str(ir["order_id"]),
                name=ir["name"],
                mrp=_f(ir["mrp"]) if ir["mrp"] is not None else None,
                discount=_f(ir["discount"]),
                paid=_f(ir["paid"]),
                category=ir["category"],
            )
            for ir in item_rows
        ],
        charges=[
            ChargeOut(id=str(cr["id"]), type=cr["type"], amount=_f(cr["amount"]))
            for cr in charge_rows
        ],
    )


async def list_orders(
    conn: asyncpg.Connection,
    start: str | None = None,
    end: str | None = None,
    platform: str | None = None,
) -> list[OrderListItem]:
    """List orders (newest first) with item counts, filterable by range/platform."""
    clauses: list[str] = []
    params: list[Any] = []

    if start:
        params.append(_parse_date(start))
        clauses.append(f"o.date >= ${len(params)}")
    if end:
        params.append(_parse_date(end))
        clauses.append(f"o.date <= ${len(params)}")
    if platform:
        params.append(platform)
        clauses.append(f"o.platform = ${len(params)}")

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    rows = await conn.fetch(
        f"""
        SELECT o.id, o.platform, o.date, o.total_paid, o.item_total, o.source,
               COALESCE(c.cnt, 0) AS item_count
        FROM orders o
        LEFT JOIN (
            SELECT order_id, count(*) AS cnt FROM items GROUP BY order_id
        ) c ON c.order_id = o.id
        {where}
        ORDER BY o.date DESC, o.created_at DESC
        """,
        *params,
    )
    return [
        OrderListItem(
            id=str(r["id"]),
            platform=r["platform"],
            date=_to_iso(r["date"]),
            total_paid=_f(r["total_paid"]),
            item_total=_f(r["item_total"]),
            source=r["source"],
            item_count=int(r["item_count"]),
        )
        for r in rows
    ]


async def delete_order(conn: asyncpg.Connection, order_id: str) -> bool:
    """Delete an order (items + charges cascade). Returns True if it existed."""
    oid = _as_uuid(order_id)
    if oid is None:
        return False
    result = await conn.execute("DELETE FROM orders WHERE id = $1", oid)
    # asyncpg returns a command tag like "DELETE 1" / "DELETE 0".
    return result.rsplit(" ", 1)[-1] != "0"


# --------------------------------------------------------------------------- #
# Items: update / delete (with order-total recompute)                          #
# --------------------------------------------------------------------------- #
async def update_item(
    conn: asyncpg.Connection, item_id: str, patch: ItemUpdate
) -> ItemOut | None:
    """Patch an item's name/paid/category; recompute the parent order totals.

    A category change is recorded as a learned correction.
    """
    iid = _as_uuid(item_id)
    if iid is None:
        return None

    async with conn.transaction():
        existing = await conn.fetchrow("SELECT * FROM items WHERE id = $1", iid)
        if existing is None:
            return None

        new_name = patch.name if patch.name is not None else existing["name"]
        new_paid = patch.paid if patch.paid is not None else _f(existing["paid"])
        new_category = (
            patch.category if patch.category is not None else existing["category"]
        )

        await conn.execute(
            "UPDATE items SET name = $1, paid = $2, category = $3 WHERE id = $4",
            new_name,
            new_paid,
            new_category,
            iid,
        )

        if patch.category is not None and patch.category != existing["category"]:
            await categorizer.record_correction(conn, new_name, new_category)

        await _recompute_order_totals(conn, existing["order_id"])

        updated = await conn.fetchrow("SELECT * FROM items WHERE id = $1", iid)

    return ItemOut(
        id=str(updated["id"]),
        order_id=str(updated["order_id"]),
        name=updated["name"],
        mrp=_f(updated["mrp"]) if updated["mrp"] is not None else None,
        discount=_f(updated["discount"]),
        paid=_f(updated["paid"]),
        category=updated["category"],
    )


async def delete_item(conn: asyncpg.Connection, item_id: str) -> bool:
    """Delete a single item and recompute its order's totals."""
    iid = _as_uuid(item_id)
    if iid is None:
        return False

    async with conn.transaction():
        row = await conn.fetchrow(
            "DELETE FROM items WHERE id = $1 RETURNING order_id", iid
        )
        if row is None:
            return False
        await _recompute_order_totals(conn, row["order_id"])
    return True


async def _recompute_order_totals(conn: asyncpg.Connection, order_uuid) -> None:
    """Recompute orders.item_total and orders.total_paid after item changes.

    total_paid keeps the order's charge/discount delta: we recompute item_total
    from the live items and shift total_paid by the same amount as item_total
    changed, preserving stored charges/discounts implicitly.
    """
    new_item_total = await conn.fetchval(
        "SELECT COALESCE(SUM(paid), 0) FROM items WHERE order_id = $1", order_uuid
    )
    new_item_total = round(_f(new_item_total), 2)

    # charges are stored as rows; discounts are folded into the original
    # total_paid. Reconstruct the non-item delta from current values.
    charge_sum = await conn.fetchval(
        "SELECT COALESCE(SUM(amount), 0) FROM charges WHERE order_id = $1", order_uuid
    )
    charge_sum = round(_f(charge_sum), 2)

    current = await conn.fetchrow(
        "SELECT item_total, total_paid FROM orders WHERE id = $1",
        order_uuid,
    )
    # discount delta = old_total_paid - old_item_total - charge_sum
    old_item_total = round(_f(current["item_total"]), 2) if current else 0.0
    old_total_paid = round(_f(current["total_paid"]), 2) if current else 0.0
    disc_delta = round(old_total_paid - old_item_total - charge_sum, 2)

    new_total_paid = round(new_item_total + charge_sum + disc_delta, 2)

    await conn.execute(
        "UPDATE orders SET item_total = $1, total_paid = $2 WHERE id = $3",
        new_item_total,
        new_total_paid,
        order_uuid,
    )


# --------------------------------------------------------------------------- #
# Summaries                                                                    #
# --------------------------------------------------------------------------- #
async def category_summary(conn: asyncpg.Connection, month: str) -> CategoriesSummary:
    """Spend per category for a month. Charges are EXCLUDED (items.paid only)."""
    first, last = _month_bounds(month)

    spend_rows = await conn.fetch(
        """
        SELECT i.category,
               COALESCE(SUM(i.paid), 0) AS spent,
               COUNT(i.id) AS item_count,
               COUNT(DISTINCT i.order_id) AS order_count
        FROM items i
        JOIN orders o ON o.id = i.order_id
        WHERE o.date >= $1 AND o.date <= $2
        GROUP BY i.category
        """,
        first,
        last,
    )
    spend_by_cat = {r["category"]: r for r in spend_rows}

    budget_rows = await conn.fetch(
        "SELECT category, limit_amount FROM budgets WHERE month = $1", first
    )
    budget_by_cat = {r["category"]: _f(r["limit_amount"]) for r in budget_rows}

    categories: list[CategorySummary] = []
    total_spent = 0.0
    for cat in CATEGORIES:
        row = spend_by_cat.get(cat)
        spent = round(_f(row["spent"]), 2) if row else 0.0
        item_count = int(row["item_count"]) if row else 0
        order_count = int(row["order_count"]) if row else 0
        budget = budget_by_cat.get(cat)
        pct = round(spent / budget * 100, 1) if budget and budget > 0 else None
        total_spent += spent
        categories.append(
            CategorySummary(
                category=cat,
                spent=spent,
                item_count=item_count,
                order_count=order_count,
                budget=budget,
                pct=pct,
            )
        )

    total_budget = round(sum(budget_by_cat.values()), 2)
    return CategoriesSummary(
        month=month,
        total_spent=round(total_spent, 2),
        total_budget=total_budget,
        categories=categories,
    )


async def charge_summary(conn: asyncpg.Connection, month: str) -> ChargesSummary:
    """Charges aggregated per platform for a month (the Platform Fees tab)."""
    first, last = _month_bounds(month)

    rows = await conn.fetch(
        """
        SELECT o.platform, c.type, COALESCE(SUM(c.amount), 0) AS amount
        FROM charges c
        JOIN orders o ON o.id = c.order_id
        WHERE o.date >= $1 AND o.date <= $2
        GROUP BY o.platform, c.type
        """,
        first,
        last,
    )

    by_platform: dict[str, dict[str, float]] = {}
    for r in rows:
        plat = r["platform"]
        bucket = by_platform.setdefault(plat, {t: 0.0 for t in CHARGE_TYPES})
        if r["type"] in bucket:
            bucket[r["type"]] = round(_f(r["amount"]), 2)

    platforms: list[ChargeSummary] = []
    grand_total = 0.0
    for plat, buckets in by_platform.items():
        total = round(sum(buckets.values()), 2)
        grand_total += total
        platforms.append(
            ChargeSummary(
                platform=plat,
                delivery=buckets["delivery"],
                handling=buckets["handling"],
                platform_fee=buckets["platform_fee"],
                packaging=buckets["packaging"],
                rain_fee=buckets["rain_fee"],
                taxes=buckets["taxes"],
                other=buckets["other"],
                total=total,
            )
        )

    platforms.sort(key=lambda p: p.total, reverse=True)
    return ChargesSummary(
        month=month, total=round(grand_total, 2), platforms=platforms
    )


async def weekly_summary(conn: asyncpg.Connection, week_start: str) -> WeeklySummary:
    """Weekly digest. `week_start` is the Monday (YYYY-MM-DD).

    "Spent" is item value (items.paid), consistent with the dashboard/budgets;
    the biggest single order is by total_paid (the largest bill).
    """
    start = _parse_date(week_start)
    end = date.fromordinal(start.toordinal() + 6)  # inclusive Sunday
    prev_start = date.fromordinal(start.toordinal() - 7)
    prev_end = date.fromordinal(start.toordinal() - 1)

    total_spent = _f(
        await conn.fetchval(
            """
            SELECT COALESCE(SUM(i.paid), 0)
            FROM items i JOIN orders o ON o.id = i.order_id
            WHERE o.date >= $1 AND o.date <= $2
            """,
            start,
            end,
        )
    )
    prev_total = _f(
        await conn.fetchval(
            """
            SELECT COALESCE(SUM(i.paid), 0)
            FROM items i JOIN orders o ON o.id = i.order_id
            WHERE o.date >= $1 AND o.date <= $2
            """,
            prev_start,
            prev_end,
        )
    )

    top_row = await conn.fetchrow(
        """
        SELECT i.category, COALESCE(SUM(i.paid), 0) AS spent
        FROM items i JOIN orders o ON o.id = i.order_id
        WHERE o.date >= $1 AND o.date <= $2
        GROUP BY i.category
        ORDER BY spent DESC
        LIMIT 1
        """,
        start,
        end,
    )
    top_category = top_row["category"] if top_row and _f(top_row["spent"]) > 0 else None
    top_category_amount = round(_f(top_row["spent"]), 2) if top_row else 0.0

    big_row = await conn.fetchrow(
        """
        SELECT id, platform, date, total_paid, item_total
        FROM orders
        WHERE date >= $1 AND date <= $2
        ORDER BY total_paid DESC
        LIMIT 1
        """,
        start,
        end,
    )
    biggest_order = (
        {
            "id": str(big_row["id"]),
            "platform": big_row["platform"],
            "date": _to_iso(big_row["date"]),
            "total_paid": _f(big_row["total_paid"]),
            "item_total": _f(big_row["item_total"]),
        }
        if big_row
        else None
    )

    daily_rows = await conn.fetch(
        """
        SELECT o.date AS d, COALESCE(SUM(i.paid), 0) AS amount
        FROM orders o LEFT JOIN items i ON i.order_id = o.id
        WHERE o.date >= $1 AND o.date <= $2
        GROUP BY o.date
        """,
        start,
        end,
    )
    by_day = {_to_iso(r["d"]): round(_f(r["amount"]), 2) for r in daily_rows}
    daily = []
    for offset in range(7):
        d = date.fromordinal(start.toordinal() + offset)
        key = d.isoformat()
        daily.append({"date": key, "amount": by_day.get(key, 0.0)})

    delta_pct = (
        round((total_spent - prev_total) / prev_total * 100, 1)
        if prev_total > 0
        else (100.0 if total_spent > 0 else 0.0)
    )

    return WeeklySummary(
        week_start=start.isoformat(),
        week_end=end.isoformat(),
        total_spent=round(total_spent, 2),
        top_category=top_category,
        top_category_amount=top_category_amount,
        biggest_order=biggest_order,
        prev_week_total=round(prev_total, 2),
        delta_pct=delta_pct,
        daily=daily,
    )


# --------------------------------------------------------------------------- #
# Budgets                                                                      #
# --------------------------------------------------------------------------- #
async def get_budgets(conn: asyncpg.Connection, month: str) -> list[BudgetOut]:
    """Budgets set for a month, each with the spend so far (items.paid)."""
    first, last = _month_bounds(month)

    rows = await conn.fetch(
        "SELECT id, category, limit_amount FROM budgets WHERE month = $1 ORDER BY category",
        first,
    )
    spent_rows = await conn.fetch(
        """
        SELECT i.category, COALESCE(SUM(i.paid), 0) AS spent
        FROM items i JOIN orders o ON o.id = i.order_id
        WHERE o.date >= $1 AND o.date <= $2
        GROUP BY i.category
        """,
        first,
        last,
    )
    spent_by_cat = {r["category"]: round(_f(r["spent"]), 2) for r in spent_rows}

    return [
        BudgetOut(
            id=str(r["id"]),
            category=r["category"],
            month=month,
            limit_amount=_f(r["limit_amount"]),
            spent=spent_by_cat.get(r["category"], 0.0),
        )
        for r in rows
    ]


async def upsert_budgets(
    conn: asyncpg.Connection, budgets: list[BudgetIn]
) -> list[BudgetOut]:
    """Upsert one or more (category, month) budgets, then return the month's set."""
    months: set[str] = set()
    async with conn.transaction():
        for b in budgets:
            first, _ = _month_bounds(b.month)
            months.add(b.month)
            await conn.execute(
                """
                INSERT INTO budgets (category, month, limit_amount)
                VALUES ($1, $2, $3)
                ON CONFLICT (category, month)
                DO UPDATE SET limit_amount = EXCLUDED.limit_amount
                """,
                b.category,
                first,
                b.limit_amount,
            )

    # Return the full set for the (single) month touched; if multiple, the last.
    month = sorted(months)[-1] if months else None
    if month is None:
        return []
    return await get_budgets(conn, month)


# --------------------------------------------------------------------------- #
# Small parsing helpers                                                        #
# --------------------------------------------------------------------------- #
def _as_uuid(value: str):
    """Parse a string into a uuid.UUID, or None if malformed."""
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        return None


def _parse_date(value: str) -> date:
    """Parse YYYY-MM-DD (lenient); fall back to today on failure."""
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except (ValueError, TypeError):
        from datetime import datetime as _dt

        return _dt.utcnow().date()
