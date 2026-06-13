"""Auto-tagging: map (item name, platform) -> one of the 8 fixed categories.

Resolution order:
  1. Learned correction (category_corrections, keyed by lower(trim(name))).
  2. A confident suggestion from the parser/LLM (if it's a real, non-"Other"
     category) — we trust a specific guess over keyword heuristics.
  3. Keyword match on the item name.
  4. Platform default (Blinkit/Instamart -> Groceries, Swiggy/Zomato -> Food).
  5. "Other".

Corrections are written whenever the user confirms/edits a category, so the
system gets better at the items this particular user actually buys.
"""
from __future__ import annotations

import asyncpg

from .schemas import CATEGORIES

# Keyword -> category. Lowercase substrings matched against the item name.
KEYWORDS: dict[str, list[str]] = {
    "Food & Dining": [
        "pizza", "burger", "biryani", "dosa", "thali", "meal", "combo", "roll",
        "noodles", "fries", "coffee", "tea", "latte", "cappuccino", "shake",
        "sandwich", "wrap", "cake", "dessert", "ice cream", "restaurant",
        "kitchen", "cafe", "momos", "paratha", "curry", "rice bowl", "snack",
    ],
    "Groceries & Essentials": [
        "milk", "bread", "egg", "rice", "atta", "flour", "dal", "oil", "sugar",
        "salt", "vegetable", "fruit", "onion", "tomato", "potato", "banana",
        "apple", "paneer", "curd", "yogurt", "butter", "cheese", "biscuit",
        "chips", "namkeen", "masala", "spice", "detergent", "soap bar",
        "tissue", "toilet", "cleaner", "dishwash", "garbage bag", "water bottle",
        "ketchup", "sauce", "noodle pack", "maggi", "tea pack", "coffee pack",
    ],
    "Transport": [
        "uber", "ola", "rapido", "auto", "cab", "taxi", "metro", "bus",
        "petrol", "diesel", "fuel", "fastag", "parking", "ride", "fare",
    ],
    "Health & Personal Care": [
        "medicine", "tablet", "syrup", "capsule", "paracetamol", "vitamin",
        "supplement", "shampoo", "conditioner", "soap", "facewash", "face wash",
        "cream", "lotion", "moisturizer", "sunscreen", "perfume", "deodorant",
        "deo", "razor", "shave", "toothpaste", "toothbrush", "sanitizer",
        "bandage", "mask", "skincare", "serum", "lip balm", "hand wash",
    ],
    "Shopping": [
        "shirt", "tshirt", "t-shirt", "jeans", "trouser", "dress", "shoe",
        "sneaker", "sandal", "watch", "bag", "wallet", "belt", "jacket",
        "electronics", "charger", "cable", "earphone", "headphone", "earbud",
        "mouse", "keyboard", "laptop", "phone case", "powerbank", "adapter",
        "amazon", "flipkart", "myntra",
    ],
    "Entertainment": [
        "movie", "ticket", "bookmyshow", "game", "steam", "playstation",
        "xbox", "concert", "event", "spotify", "netflix", "prime video",
        "hotstar", "disney", "ott",
    ],
    "Utilities & Subscriptions": [
        "recharge", "prepaid", "postpaid", "broadband", "internet", "wifi",
        "electricity", "bill", "gas", "dth", "subscription", "swiggy one",
        "zomato gold", "membership", "plan", "data pack", "renewal",
    ],
}

PLATFORM_DEFAULT: dict[str, str] = {
    "Blinkit": "Groceries & Essentials",
    "Instamart": "Groceries & Essentials",
    "Swiggy": "Food & Dining",
    "Zomato": "Food & Dining",
}


def _key(name: str) -> str:
    return (name or "").strip().lower()


async def _lookup_correction(conn: asyncpg.Connection, key: str) -> str | None:
    if not key:
        return None
    row = await conn.fetchrow(
        "SELECT category FROM category_corrections WHERE item_key = $1", key
    )
    return row["category"] if row else None


def _keyword_match(name: str) -> str | None:
    low = (name or "").lower()
    if not low:
        return None
    for category, words in KEYWORDS.items():
        if any(word in low for word in words):
            return category
    return None


async def categorize(
    conn: asyncpg.Connection,
    name: str,
    platform: str,
    suggested: str | None = None,
) -> str:
    """Return the best category for an item. See module docstring for order."""
    key = _key(name)

    correction = await _lookup_correction(conn, key)
    if correction in CATEGORIES:
        return correction

    if suggested in CATEGORIES and suggested != "Other":
        return suggested

    keyword = _keyword_match(name)
    if keyword:
        return keyword

    return PLATFORM_DEFAULT.get(platform, "Other")


async def record_correction(
    conn: asyncpg.Connection, name: str, category: str
) -> None:
    """Persist a (name -> category) decision to improve future tagging.

    Only real categories are stored; "Other" is treated as "no signal" and
    skipped so it doesn't pin an item to the catch-all forever.
    """
    key = _key(name)
    if not key or category not in CATEGORIES or category == "Other":
        return
    await conn.execute(
        """
        INSERT INTO category_corrections (item_key, category, updated_at)
        VALUES ($1, $2, now())
        ON CONFLICT (item_key)
        DO UPDATE SET category = EXCLUDED.category, updated_at = now()
        """,
        key,
        category,
    )
