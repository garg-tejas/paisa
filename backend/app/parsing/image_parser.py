"""Image parse flow: glm-ocr -> glm-4.7-flash -> categorised ParseResult.

    User uploads image (JPG / PNG / screenshot)
      -> glm-ocr (/layout_parsing) extracts text/markdown
      -> glm-4.7-flash (free) structures it into the canonical schema
      -> items are categorised

Image parses are ALWAYS flagged needs_review=True — the user must eyeball a
photographed/screenshotted receipt before saving (contract + PRD).
"""
from __future__ import annotations

import asyncpg

from .. import categorizer
from ..schemas import ParsedOrder, ParseResult
from .glm_client import ocr_extract, structure_receipt


async def parse_image(
    image_bytes: bytes, mime: str, conn: asyncpg.Connection
) -> ParseResult:
    """Run the full image pipeline and return a ParseResult (not persisted)."""
    text = await ocr_extract(image_bytes, mime)
    order, confidence = await structure_receipt(text)

    platform = order.get("platform", "Manual")
    for item in order.get("items", []):
        item["category"] = await categorizer.categorize(
            conn, item.get("name", ""), platform, suggested=item.get("category")
        )

    parsed = ParsedOrder(**{**order, "source": "image"})
    return ParseResult(
        order=parsed,
        confidence=round(confidence, 2),
        needs_review=True,
        source="image",
    )
