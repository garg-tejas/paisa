"""GLM (Z.ai) API clients for OCR and receipt structuring.

Base URL:  https://api.z.ai/api/paas/v4
Auth:      Authorization: Bearer <GLM_API_KEY>

Two async helpers:
  - ocr_extract(image_bytes, mime)      -> extracted markdown/text (model "glm-ocr")
  - structure_receipt(raw_text)         -> (canonical-schema dict, confidence) (model "glm-4.7-flash", FREE)
"""

from __future__ import annotations

import base64
import json
import re
from typing import Any

import httpx

from app.config import settings

# ---------------------------------------------------------------------------
# Limits (per Z.ai docs): 10MB per image, 50MB per pdf.
# ---------------------------------------------------------------------------
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_PDF_BYTES = 50 * 1024 * 1024

BASE_URL = "https://api.z.ai/api/paas/v4"
_TIMEOUT = httpx.Timeout(120.0, connect=15.0)

# The 8 fixed categories (kept in sync with the canonical contract).
CATEGORIES = [
    "Food & Dining",
    "Groceries & Essentials",
    "Transport",
    "Health & Personal Care",
    "Shopping",
    "Entertainment",
    "Utilities & Subscriptions",
    "Other",
]

_STRUCTURE_SYSTEM_PROMPT = (
    "You convert raw receipt / invoice text into a STRICT JSON object following "
    "EXACTLY this schema (no extra keys, no commentary):\n"
    "{\n"
    '  "platform": "Blinkit|Instamart|Swiggy|Zomato|Manual",\n'
    '  "date": "YYYY-MM-DD",\n'
    '  "order_id": "string or null",\n'
    '  "items": [ { "name": "str", "mrp": number_or_null, "discount": number, '
    '"paid": number, "category": "<one of the 8 categories>" } ],\n'
    '  "charges": { "delivery": number, "handling": number, "platform_fee": number, '
    '"packaging": number, "rain_fee": number, "taxes": number, "other": number },\n'
    '  "discounts": { "coupon": number, "membership": number, "other": number },\n'
    '  "item_total": number,\n'
    '  "total_paid": number\n'
    "}\n\n"
    "The 8 allowed categories (use these EXACT strings):\n"
    + "\n".join(f"  - {c}" for c in CATEGORIES)
    + "\n\n"
    "RULES:\n"
    "- Charges (delivery, handling, platform fee, packaging, rain/surge fee, taxes/GST, "
    "other fees) are NEVER folded into item prices. Put them ONLY in the charges object.\n"
    "- Coupons / membership savings / cashback go in discounts, not items.\n"
    "- Each item's `paid` is what was actually paid for that item (mrp - discount).\n"
    "- item_total = sum of items[].paid.\n"
    "- total_paid = item_total + sum(all charges) - sum(all discounts).\n"
    "- All money values are plain numbers in INR rupees with up to 2 decimals (no symbols, no commas).\n"
    "- If a value is unknown use 0 for numbers, null for order_id, and best-guess the platform.\n"
    "- Output ONLY the JSON object. No markdown fences, no prose."
)


def _auth_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.GLM_API_KEY}",
        "Content-Type": "application/json",
    }


def _data_uri(data: bytes, mime: str) -> str:
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{b64}"


async def ocr_extract(image_bytes: bytes, mime: str) -> str:
    """Run OCR on an image (or pdf) via GLM and return extracted markdown/text.

    POST /layout_parsing with body:
        {"model": "glm-ocr", "file": <base64 data URI>}

    ASSUMPTION (the single line to change if the live API differs):
        The "file" field is sent as a base64 *data URI*
        ("data:<mime>;base64,<...>"). The Z.ai docs also show a plain URL form
        for "file"; if the live API rejects the data URI, change the
        `payload["file"] = _data_uri(...)` line below to pass a hosted URL
        (or whatever the live API expects).
    """
    # Enforce documented size limits.
    if mime == "application/pdf":
        if len(image_bytes) > MAX_PDF_BYTES:
            raise ValueError(f"PDF exceeds {MAX_PDF_BYTES} byte limit for OCR")
    else:
        if len(image_bytes) > MAX_IMAGE_BYTES:
            raise ValueError(f"Image exceeds {MAX_IMAGE_BYTES} byte limit for OCR")

    payload: dict[str, Any] = {
        "model": "glm-ocr",
        # ---- ASSUMPTION: base64 data URI (see docstring) ----
        "file": _data_uri(image_bytes, mime),
    }

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=_TIMEOUT) as client:
        resp = await client.post(
            "/layout_parsing", headers=_auth_headers(), json=payload
        )
        resp.raise_for_status()
        data = resp.json()

    return _extract_ocr_text(data)


def _extract_ocr_text(data: Any) -> str:
    """Pull plain markdown/text out of a variety of plausible OCR response shapes."""
    if isinstance(data, str):
        return data
    if not isinstance(data, dict):
        return str(data)

    # Common top-level keys the layout parser might use.
    for key in ("markdown", "text", "content", "result", "output", "data"):
        if key in data:
            val = data[key]
            if isinstance(val, str) and val.strip():
                return val
            if isinstance(val, dict):
                nested = _extract_ocr_text(val)
                if nested.strip():
                    return nested
            if isinstance(val, list):
                parts = [_extract_ocr_text(v) for v in val]
                joined = "\n".join(p for p in parts if p.strip())
                if joined.strip():
                    return joined

    # OpenAI-style chat completion fallback.
    choices = data.get("choices")
    if isinstance(choices, list) and choices:
        msg = choices[0].get("message") or {}
        if isinstance(msg, dict) and isinstance(msg.get("content"), str):
            return msg["content"]

    # Last resort: dump the whole thing so structure_receipt can still try.
    return json.dumps(data, ensure_ascii=False)


async def structure_receipt(raw_text: str) -> tuple[dict, float]:
    """Convert raw receipt text into the canonical schema dict via glm-4.7-flash (FREE).

    Returns (canonical-shaped dict, confidence 0..1).
    """
    if not raw_text or not raw_text.strip():
        return _empty_order(), 0.0

    payload: dict[str, Any] = {
        "model": "glm-4.7-flash",
        "messages": [
            {"role": "system", "content": _STRUCTURE_SYSTEM_PROMPT},
            {"role": "user", "content": raw_text},
        ],
        "temperature": 0,
        # response_format json_object if the API supports it; harmless if ignored.
        "response_format": {"type": "json_object"},
    }

    content = ""
    try:
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=_TIMEOUT) as client:
            resp = await client.post(
                "/chat/completions", headers=_auth_headers(), json=payload
            )
            resp.raise_for_status()
            data = resp.json()
        content = _chat_content(data)
    except httpx.HTTPError:
        # Network / API failure -> degrade gracefully, caller can flag review.
        return _empty_order(), 0.0

    parsed = _safe_json(content)
    if parsed is None:
        return _empty_order(), 0.0

    order = _coerce_order(parsed)
    confidence = _estimate_confidence(order)
    return order, confidence


def _chat_content(data: Any) -> str:
    if not isinstance(data, dict):
        return str(data)
    choices = data.get("choices")
    if isinstance(choices, list) and choices:
        msg = choices[0].get("message") or {}
        if isinstance(msg, dict):
            content = msg.get("content")
            if isinstance(content, str):
                return content
        # Some APIs put the text directly on the choice.
        text = choices[0].get("text")
        if isinstance(text, str):
            return text
    return ""


def _safe_json(content: str) -> dict | None:
    """Best-effort JSON extraction from a model response (handles stray fences/prose)."""
    if not content:
        return None
    content = content.strip()

    # Strip markdown fences if present.
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", content, re.DOTALL)
    if fence:
        content = fence.group(1).strip()

    try:
        obj = json.loads(content)
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        pass

    # Grab the first {...} block.
    start = content.find("{")
    end = content.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            obj = json.loads(content[start : end + 1])
            return obj if isinstance(obj, dict) else None
        except json.JSONDecodeError:
            return None
    return None


def _num(v: Any, default: float = 0.0) -> float:
    if v is None:
        return default
    if isinstance(v, (int, float)):
        return round(float(v), 2)
    if isinstance(v, str):
        cleaned = re.sub(r"[^\d.\-]", "", v)
        if cleaned in ("", "-", ".", "-."):
            return default
        try:
            return round(float(cleaned), 2)
        except ValueError:
            return default
    return default


def _num_or_none(v: Any) -> float | None:
    if v is None:
        return None
    n = _num(v, default=0.0)
    return n


def _empty_order() -> dict:
    return {
        "platform": "Manual",
        "date": "",
        "order_id": None,
        "items": [],
        "charges": {
            "delivery": 0.0,
            "handling": 0.0,
            "platform_fee": 0.0,
            "packaging": 0.0,
            "rain_fee": 0.0,
            "taxes": 0.0,
            "other": 0.0,
        },
        "discounts": {"coupon": 0.0, "membership": 0.0, "other": 0.0},
        "item_total": 0.0,
        "total_paid": 0.0,
    }


def _coerce_order(raw: dict) -> dict:
    """Coerce a loosely-shaped model dict into the canonical schema (types + keys)."""
    order = _empty_order()

    platform = raw.get("platform")
    if isinstance(platform, str) and platform.strip():
        order["platform"] = platform.strip()

    date = raw.get("date")
    if isinstance(date, str):
        order["date"] = date.strip()

    oid = raw.get("order_id")
    order["order_id"] = oid if (isinstance(oid, str) and oid.strip()) else None

    items_raw = raw.get("items")
    items: list[dict] = []
    if isinstance(items_raw, list):
        for it in items_raw:
            if not isinstance(it, dict):
                continue
            name = it.get("name")
            if not isinstance(name, str) or not name.strip():
                continue
            mrp = _num_or_none(it.get("mrp"))
            discount = _num(it.get("discount"), 0.0)
            paid = _num(it.get("paid"), 0.0)
            if paid == 0.0 and mrp is not None:
                paid = round(max(mrp - discount, 0.0), 2)
            category = it.get("category")
            category = category if (isinstance(category, str) and category.strip()) else "Other"
            items.append(
                {
                    "name": name.strip(),
                    "mrp": mrp,
                    "discount": discount,
                    "paid": paid,
                    "category": category,
                }
            )
    order["items"] = items

    charges_raw = raw.get("charges") or {}
    if isinstance(charges_raw, dict):
        for k in order["charges"]:
            order["charges"][k] = _num(charges_raw.get(k), 0.0)

    disc_raw = raw.get("discounts") or {}
    if isinstance(disc_raw, dict):
        for k in order["discounts"]:
            order["discounts"][k] = _num(disc_raw.get(k), 0.0)

    # Compute / validate totals from the contract formulas.
    item_total = round(sum(i["paid"] for i in items), 2)
    charge_sum = round(sum(order["charges"].values()), 2)
    disc_sum = round(sum(order["discounts"].values()), 2)

    given_item_total = _num(raw.get("item_total"), 0.0)
    order["item_total"] = item_total if item_total > 0 else given_item_total

    given_total = _num(raw.get("total_paid"), 0.0)
    computed_total = round(order["item_total"] + charge_sum - disc_sum, 2)
    # Prefer the computed total; fall back to the model's value if computation is 0.
    order["total_paid"] = computed_total if computed_total > 0 else given_total

    return order


def _estimate_confidence(order: dict) -> float:
    """Heuristic confidence for an LLM-structured order."""
    conf = 0.5
    if order["items"]:
        conf += 0.25
    if order.get("date"):
        conf += 0.1
    if order.get("order_id"):
        conf += 0.05
    if order["total_paid"] > 0:
        conf += 0.1
    return round(min(conf, 0.95), 2)
