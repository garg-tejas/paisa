"""PDF parse flow: pdfplumber -> deterministic parser -> (fallback) glm-4.7-flash.

    User uploads PDF
      -> pdfplumber extracts raw text (free, local)
      -> deterministic parser -> (dict, confidence)
      -> if confidence < THRESHOLD, glm-4.7-flash structures the same text (free)
      -> items are categorised (corrections > suggestion > keywords > platform)

Returns a ParseResult with source="pdf".
"""
from __future__ import annotations

import asyncpg

from .. import categorizer
from ..schemas import ParsedOrder, ParseResult
from .deterministic_parser import deterministic_parser
from .glm_client import structure_receipt
from .pdfplumber_extract import pdfplumber_extract

# Below this, we ask the free LLM to take a crack at the same text.
FALLBACK_THRESHOLD = 0.6
# Above this we consider the parse trustworthy enough to skip a forced review.
REVIEW_THRESHOLD = 0.8


async def parse_pdf(pdf_bytes: bytes, conn: asyncpg.Connection) -> ParseResult:
    """Run the full PDF pipeline and return a ParseResult (not persisted)."""
    text = pdfplumber_extract(pdf_bytes)

    order, confidence = deterministic_parser(text)

    if confidence < FALLBACK_THRESHOLD and text.strip():
        llm_order, llm_conf = await structure_receipt(text)
        # Take the LLM result if it did better (it usually does on messy PDFs).
        if llm_conf > confidence and llm_order.get("items"):
            order, confidence = llm_order, llm_conf

    await _categorize_items(order, conn)

    parsed = ParsedOrder(**{**order, "source": "pdf"})
    needs_review = confidence < REVIEW_THRESHOLD or not parsed.items
    return ParseResult(
        order=parsed,
        confidence=round(confidence, 2),
        needs_review=needs_review,
        source="pdf",
    )


async def _categorize_items(order: dict, conn: asyncpg.Connection) -> None:
    platform = order.get("platform", "Manual")
    for item in order.get("items", []):
        item["category"] = await categorizer.categorize(
            conn,
            item.get("name", ""),
            platform,
            suggested=item.get("category"),
        )
