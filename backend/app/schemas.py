"""Pydantic schemas — the single source of truth for API payloads.

Class and field names mirror the project contract EXACTLY so that the
frontend's TypeScript interfaces and every backend router line up without
any cross-module guessing.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

# The 8 fixed categories (exact strings, in canonical order). Re-exported here
# so other backend modules can import a single authoritative list.
CATEGORIES: list[str] = [
    "Food & Dining",
    "Groceries & Essentials",
    "Transport",
    "Health & Personal Care",
    "Shopping",
    "Entertainment",
    "Utilities & Subscriptions",
    "Other",
]


# ---------------------------------------------------------------------------
# Core parse / order building blocks
# ---------------------------------------------------------------------------
class Item(BaseModel):
    name: str
    mrp: float | None = None
    discount: float = 0
    paid: float
    category: str


class Charges(BaseModel):
    delivery: float = 0
    handling: float = 0
    platform_fee: float = 0
    packaging: float = 0
    rain_fee: float = 0
    taxes: float = 0
    other: float = 0


class Discounts(BaseModel):
    coupon: float = 0
    membership: float = 0
    other: float = 0


class ParsedOrder(BaseModel):
    """Used as BOTH the parse-result payload and the POST /orders body.

    `source` / `note` are optional on parse output and supplied by the client
    on save: manual entries send "manual"; confirmed uploads carry the parse
    origin ("pdf" | "image"). They map onto orders.source / orders.note.
    """

    platform: str
    date: str
    order_id: str | None = None
    items: list[Item]
    charges: Charges = Field(default_factory=Charges)
    discounts: Discounts = Field(default_factory=Discounts)
    item_total: float = 0
    total_paid: float = 0
    source: str = "manual"  # pdf | image | manual
    note: str | None = None


class ParseResult(BaseModel):
    order: ParsedOrder
    confidence: float
    needs_review: bool
    source: str  # "pdf" | "image"


# ---------------------------------------------------------------------------
# Persisted / output shapes
# ---------------------------------------------------------------------------
class ItemOut(BaseModel):
    id: str
    order_id: str
    name: str
    mrp: float | None
    discount: float
    paid: float
    category: str


class ChargeOut(BaseModel):
    id: str
    type: str
    amount: float


class OrderOut(BaseModel):
    id: str
    platform: str
    date: str
    order_id: str | None
    item_total: float
    total_paid: float
    source: str
    note: str | None
    created_at: str
    items: list[ItemOut]
    charges: list[ChargeOut]


class OrderListItem(BaseModel):
    id: str
    platform: str
    date: str
    total_paid: float
    item_total: float
    source: str
    item_count: int


# ---------------------------------------------------------------------------
# Mutations
# ---------------------------------------------------------------------------
class ItemUpdate(BaseModel):
    name: str | None = None
    paid: float | None = None
    category: str | None = None


# ---------------------------------------------------------------------------
# Budgets
# ---------------------------------------------------------------------------
class BudgetIn(BaseModel):
    category: str
    month: str  # "YYYY-MM"
    limit_amount: float


class BudgetOut(BaseModel):
    id: str
    category: str
    month: str
    limit_amount: float
    spent: float


# ---------------------------------------------------------------------------
# Summaries
# ---------------------------------------------------------------------------
class CategorySummary(BaseModel):
    category: str
    spent: float
    item_count: int
    order_count: int
    budget: float | None
    pct: float | None


class CategoriesSummary(BaseModel):
    month: str
    total_spent: float
    total_budget: float
    categories: list[CategorySummary]


class ChargeSummary(BaseModel):
    platform: str
    delivery: float
    handling: float
    platform_fee: float
    packaging: float
    rain_fee: float
    taxes: float
    other: float
    total: float


class ChargesSummary(BaseModel):
    month: str
    total: float
    platforms: list[ChargeSummary]


class WeeklySummary(BaseModel):
    week_start: str
    week_end: str
    total_spent: float
    top_category: str | None
    top_category_amount: float
    biggest_order: dict | None
    prev_week_total: float
    delta_pct: float
    daily: list[dict]  # daily item: {date, amount}


# ---------------------------------------------------------------------------
# Push
# ---------------------------------------------------------------------------
class PushSubscriptionIn(BaseModel):
    endpoint: str
    keys: dict  # contains "p256dh" & "auth"
    notify_hour: int = 22
