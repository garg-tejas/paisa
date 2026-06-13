"""Extract plain text from a PDF receipt using pdfplumber."""

from __future__ import annotations

import io

import pdfplumber


def pdfplumber_extract(pdf_bytes: bytes) -> str:
    """Return the concatenated text of every page in the PDF.

    Tables are extracted separately and appended so the deterministic parser
    can see line-item rows that pdfplumber's plain text flow sometimes mangles.
    """
    chunks: list[str] = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if text.strip():
                chunks.append(text)

            # Append table rows as tab-joined lines (helps line-item detection).
            try:
                tables = page.extract_tables() or []
            except Exception:
                tables = []
            for table in tables:
                for row in table:
                    cells = [str(c).strip() for c in row if c is not None and str(c).strip()]
                    if cells:
                        chunks.append("\t".join(cells))

    return "\n".join(chunks).strip()
