"""Receipt-parsing routes. Neither endpoint persists anything — they return a
ParseResult for the user to review and confirm via POST /orders.

POST /parse/pdf    multipart "file" -> ParseResult (pdfplumber -> deterministic -> GLM)
POST /parse/image  multipart "file" -> ParseResult (glm-ocr -> glm-4.7-flash)
"""
from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..config import settings
from ..db import get_conn
from ..parsing.image_parser import parse_image
from ..parsing.pdf_pipeline import parse_pdf
from ..schemas import ParseResult

router = APIRouter(tags=["parse"])

_IMAGE_MIMES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"}

# Receipts are small; reject anything large before it's parsed (or shipped to GLM).
_MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15 MB


def _check_size(data: bytes) -> None:
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(data) // (1024 * 1024)} MB). Max 15 MB.",
        )


def _guess_mime(upload: UploadFile, default: str) -> str:
    if upload.content_type and upload.content_type != "application/octet-stream":
        return upload.content_type
    name = (upload.filename or "").lower()
    if name.endswith(".png"):
        return "image/png"
    if name.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    if name.endswith(".webp"):
        return "image/webp"
    if name.endswith(".pdf"):
        return "application/pdf"
    return default


@router.post("/parse/pdf", response_model=ParseResult)
async def parse_pdf_route(
    file: UploadFile = File(...),
    conn: asyncpg.Connection = Depends(get_conn),
) -> ParseResult:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file.")
    _check_size(data)
    try:
        return await parse_pdf(data, conn)
    except Exception as exc:  # noqa: BLE001 - surface a clean 422 to the client
        raise HTTPException(
            status_code=422, detail=f"Could not parse PDF: {exc}"
        ) from exc


@router.post("/parse/image", response_model=ParseResult)
async def parse_image_route(
    file: UploadFile = File(...),
    conn: asyncpg.Connection = Depends(get_conn),
) -> ParseResult:
    if not settings.GLM_API_KEY:
        # Image OCR needs the GLM key; fail loudly so the UI can show a banner
        # and steer the user to manual entry (per the PRD fallback).
        raise HTTPException(
            status_code=503,
            detail="Image parsing unavailable: GLM_API_KEY is not configured. "
            "Use manual entry instead.",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file.")
    _check_size(data)

    mime = _guess_mime(file, default="image/jpeg")
    if mime not in _IMAGE_MIMES and mime != "application/pdf":
        raise HTTPException(status_code=415, detail=f"Unsupported image type: {mime}")

    try:
        return await parse_image(data, mime, conn)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=422, detail=f"Could not parse image: {exc}"
        ) from exc
