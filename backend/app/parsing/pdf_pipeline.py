"""PDF parse flow: glm-ocr -> glm-4.7-flash (identical to the image pipeline).

pdfplumber and the deterministic parser are intentionally removed: pdfplumber's
plain-text output caused the regex parser to confidently mis-read HSN codes,
FSSAI licence numbers and pincodes as item prices. GLM OCR renders the PDF
directly and returns structured markdown that glm-4.7-flash parses cleanly.

Returns a ParseResult with source="pdf".
"""
from __future__ import annotations

import asyncpg

from .. import categorizer
from ..schemas import ParsedOrder, ParseResult
from .glm_client import ocr_extract, structure_receipt

REVIEW_THRESHOLD = 0.8


async def parse_pdf(pdf_bytes: bytes, conn: asyncpg.Connection) -> ParseResult:
    """Run the full PDF pipeline and return a ParseResult (not persisted)."""
    text = await ocr_extract(pdf_bytes, "application/pdf")
    order, confidence = await structure_receipt(text)

    platform = order.get("platform", "Manual")
    for item in order.get("items", []):
        item["category"] = await categorizer.categorize(
            conn,
            item.get("name", ""),
            platform,
            suggested=item.get("category"),
        )

    parsed = ParsedOrder(**{**order, "source": "pdf"})
    needs_review = confidence < REVIEW_THRESHOLD or not parsed.items
    return ParseResult(
        order=parsed,
        confidence=round(confidence, 2),
        needs_review=needs_review,
        source="pdf",
    )
