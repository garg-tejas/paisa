"""Deterministic, zero-cost parser for digital PDF receipts.

Operates purely on pdfplumber's extracted text. It recognises platform,
order id, date, charge lines, and line items via regex/heuristics, and returns
(canonical-schema dict, confidence 0..1). When it can't find items confidently
the confidence is low, which signals the pipeline to fall back to the free
glm-4.7-flash structurer.

No category assignment happens here — the pipeline runs items through the
categorizer afterwards (so learned corrections apply uniformly).
"""
from __future__ import annotations

import re
from datetime import datetime

# Charge line labels -> canonical charge bucket.
_CHARGE_PATTERNS: list[tuple[str, str]] = [
    (r"delivery\s*(?:charge|fee|partner fee)?", "delivery"),
    (r"handling\s*(?:charge|fee)?", "handling"),
    (r"platform\s*fee", "platform_fee"),
    (r"packaging\s*(?:charge|fee)?", "packaging"),
    (r"(?:rain|surge|high\s*traffic)\s*(?:fee|charge|surcharge)?", "rain_fee"),
    (r"(?:gst|tax|taxes|cgst|sgst|igst)\b", "taxes"),
    (r"small\s*cart\s*(?:charge|fee)?", "other"),
    (r"tip\b", "other"),
]

_DISCOUNT_PATTERNS: list[tuple[str, str]] = [
    (r"coupon|promo|discount applied|item discount", "coupon"),
    (r"membership|swiggy one|zomato gold|bbstar|simpl", "membership"),
    (r"cashback|wallet|savings", "other"),
]

_PLATFORMS = ["Blinkit", "Instamart", "Swiggy", "Zomato"]

# A trailing amount like "₹199", "Rs. 199.00", "199.00", "INR 199".
_AMOUNT_RE = r"(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*\.?[0-9]{0,2})"

# Lines that are clearly NOT items.
_SKIP_LINE_RE = re.compile(
    r"(sub\s*total|grand\s*total|total\s*(?:paid|amount|payable)|to\s*pay|"
    r"order\s*id|invoice|gstin|cgst|sgst|igst|tax|delivery|handling|"
    r"platform\s*fee|packaging|coupon|discount|savings|membership|"
    r"bill\s*total|item\s*total|mrp\s*total|amount\s*payable|paid\s*via|"
    r"thank\s*you|customer|address|phone|date|time)",
    re.IGNORECASE,
)


def _to_amount(raw: str) -> float:
    try:
        return round(float(raw.replace(",", "")), 2)
    except (ValueError, AttributeError):
        return 0.0


def _detect_platform(text: str) -> str:
    low = text.lower()
    for plat in _PLATFORMS:
        if plat.lower() in low:
            return plat
    return "Manual"


def _detect_order_id(text: str) -> str | None:
    patterns = [
        r"order\s*(?:id|no\.?|number|#)\s*[:#]?\s*([A-Za-z0-9\-]{4,})",
        r"invoice\s*(?:no\.?|number|#)\s*[:#]?\s*([A-Za-z0-9\-]{4,})",
        r"#\s*(\d{6,})",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return None


def _detect_date(text: str) -> str:
    """Find a date and normalise to YYYY-MM-DD; default to today."""
    candidates = [
        (r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", "%Y-%m-%d", ("y", "m", "d")),
        (r"(\d{1,2})[-/](\d{1,2})[-/](\d{4})", "%d-%m-%Y", ("d", "m", "y")),
    ]
    for pat, _fmt, order in candidates:
        m = re.search(pat, text)
        if m:
            parts = dict(zip(order, m.groups()))
            try:
                y = int(parts["y"])
                mo = int(parts["m"])
                d = int(parts["d"])
                return datetime(y, mo, d).date().isoformat()
            except (ValueError, KeyError):
                continue

    # Textual month, e.g. "31 May 2026" / "May 31, 2026".
    m = re.search(
        r"(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})|([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})",
        text,
    )
    if m:
        for fmt, groups in (("%d %B %Y", (1, 2, 3)), ("%B %d %Y", (4, 5, 6))):
            try:
                vals = [m.group(g) for g in groups]
                if all(vals):
                    return datetime.strptime(" ".join(vals), fmt).date().isoformat()
            except (ValueError, TypeError):
                continue

    return datetime.utcnow().date().isoformat()


def _extract_charges(text: str) -> tuple[dict, dict]:
    """Return (charges, discounts) dicts read from labelled lines."""
    charges = {
        "delivery": 0.0, "handling": 0.0, "platform_fee": 0.0,
        "packaging": 0.0, "rain_fee": 0.0, "taxes": 0.0, "other": 0.0,
    }
    discounts = {"coupon": 0.0, "membership": 0.0, "other": 0.0}

    for line in text.splitlines():
        low = line.lower()

        for pat, bucket in _CHARGE_PATTERNS:
            if re.search(pat, low):
                m = re.search(_AMOUNT_RE + r"\s*$", line.strip(), re.IGNORECASE)
                if m:
                    charges[bucket] = round(charges[bucket] + _to_amount(m.group(1)), 2)
                break

        for pat, bucket in _DISCOUNT_PATTERNS:
            if re.search(pat, low):
                m = re.search(_AMOUNT_RE + r"\s*$", line.strip(), re.IGNORECASE)
                if m:
                    discounts[bucket] = round(
                        discounts[bucket] + abs(_to_amount(m.group(1))), 2
                    )
                break

    return charges, discounts


def _extract_total(text: str) -> float:
    """Best-effort grand total (used only for confidence checking)."""
    for line in text.splitlines():
        if re.search(r"(grand\s*total|total\s*paid|amount\s*payable|to\s*pay)", line, re.IGNORECASE):
            m = re.search(_AMOUNT_RE + r"\s*$", line.strip(), re.IGNORECASE)
            if m:
                return _to_amount(m.group(1))
    return 0.0


def _extract_items(text: str) -> list[dict]:
    """Pull line items: a name followed by a trailing money amount."""
    items: list[dict] = []
    line_re = re.compile(r"^(.*\S)\s+" + _AMOUNT_RE + r"\s*$", re.IGNORECASE)

    for raw in text.splitlines():
        line = raw.strip().replace("\t", " ")
        if not line or _SKIP_LINE_RE.search(line):
            continue
        m = line_re.match(line)
        if not m:
            continue
        name = m.group(1).strip(" -•·\t")
        amount = _to_amount(m.group(2))
        # Reject lines whose "name" is just digits/symbols or too short.
        if amount <= 0 or len(re.sub(r"[^A-Za-z]", "", name)) < 2:
            continue

        # Try to split an optional qty prefix like "2 x " or "2x".
        qty_m = re.match(r"^(\d+)\s*[xX×]\s*(.+)$", name)
        if qty_m:
            name = qty_m.group(2).strip()

        items.append(
            {
                "name": name,
                "mrp": None,
                "discount": 0.0,
                "paid": amount,
                "category": "Other",
            }
        )

    return items


def deterministic_parser(text: str) -> tuple[dict, float]:
    """Parse raw PDF text into the canonical schema dict + a confidence score."""
    if not text or not text.strip():
        return _empty(), 0.0

    platform = _detect_platform(text)
    order_id = _detect_order_id(text)
    order_date = _detect_date(text)
    charges, discounts = _extract_charges(text)
    items = _extract_items(text)
    grand_total = _extract_total(text)

    item_total = round(sum(i["paid"] for i in items), 2)
    charge_sum = round(sum(charges.values()), 2)
    disc_sum = round(sum(discounts.values()), 2)
    total_paid = round(item_total + charge_sum - disc_sum, 2)

    order = {
        "platform": platform,
        "date": order_date,
        "order_id": order_id,
        "items": items,
        "charges": charges,
        "discounts": discounts,
        "item_total": item_total,
        "total_paid": total_paid,
    }

    confidence = _confidence(order, grand_total)
    return order, confidence


def _confidence(order: dict, grand_total: float) -> float:
    """Heuristic confidence: rewards finding items, a platform, and a matching total."""
    conf = 0.0
    items = order["items"]
    if not items:
        return 0.1

    conf += 0.4  # found at least one item
    if len(items) >= 2:
        conf += 0.1
    if order["platform"] != "Manual":
        conf += 0.1
    if order["order_id"]:
        conf += 0.1

    # Reconcile computed total vs the printed grand total.
    if grand_total > 0:
        diff = abs(order["total_paid"] - grand_total)
        tolerance = max(1.0, grand_total * 0.02)
        if diff <= tolerance:
            conf += 0.3
        elif diff <= grand_total * 0.1:
            conf += 0.1
        else:
            conf -= 0.1  # totals disagree -> let the LLM try

    return round(max(0.0, min(conf, 0.97)), 2)


def _empty() -> dict:
    return {
        "platform": "Manual",
        "date": datetime.utcnow().date().isoformat(),
        "order_id": None,
        "items": [],
        "charges": {
            "delivery": 0.0, "handling": 0.0, "platform_fee": 0.0,
            "packaging": 0.0, "rain_fee": 0.0, "taxes": 0.0, "other": 0.0,
        },
        "discounts": {"coupon": 0.0, "membership": 0.0, "other": 0.0},
        "item_total": 0.0,
        "total_paid": 0.0,
    }
