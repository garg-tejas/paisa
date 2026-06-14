"""Receipt-parsing routes. Both parse routes return a job_id immediately so
the response is sent before Heroku's hard 30-second router timeout.

POST /parse/pdf              -> {"job_id": "..."}
POST /parse/image            -> {"job_id": "..."}
GET  /parse/job/{job_id}     -> {"status": "processing"|"done"|"error", ...}

The actual OCR + LLM work runs as an asyncio background task. Poll every
2-3 seconds until status is "done" or "error". Jobs are kept in memory
(single-user single-dyno — intentional; no Redis needed).
"""
from __future__ import annotations

import asyncio
import uuid
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile

from ..config import settings
from ..db import get_pool
from ..parsing.image_parser import parse_image
from ..parsing.pdf_pipeline import parse_pdf

router = APIRouter(tags=["parse"])

_IMAGE_MIMES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"}
_MAX_UPLOAD_BYTES = 15 * 1024 * 1024

# In-memory job store. Capped at 20 entries (FIFO) — fine for personal use.
_jobs: dict[str, dict[str, Any]] = {}
_MAX_JOBS = 20


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


def _new_job() -> str:
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "processing"}
    # Evict oldest entry when over the cap.
    while len(_jobs) > _MAX_JOBS:
        del _jobs[next(iter(_jobs))]
    return job_id


async def _run_pdf(job_id: str, pdf_bytes: bytes) -> None:
    try:
        async with get_pool().acquire() as conn:
            result = await parse_pdf(pdf_bytes, conn)
        _jobs[job_id] = {"status": "done", "result": result.model_dump()}
    except Exception as exc:  # noqa: BLE001
        _jobs[job_id] = {"status": "error", "detail": str(exc)}


async def _run_image(job_id: str, image_bytes: bytes, mime: str) -> None:
    try:
        async with get_pool().acquire() as conn:
            result = await parse_image(image_bytes, mime, conn)
        _jobs[job_id] = {"status": "done", "result": result.model_dump()}
    except Exception as exc:  # noqa: BLE001
        _jobs[job_id] = {"status": "error", "detail": str(exc)}


@router.post("/parse/pdf")
async def parse_pdf_route(file: UploadFile = File(...)) -> dict:
    if not settings.GLM_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="PDF parsing unavailable: GLM_API_KEY is not configured. "
            "Use manual entry instead.",
        )
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file.")
    _check_size(data)
    job_id = _new_job()
    asyncio.create_task(_run_pdf(job_id, data))
    return {"job_id": job_id}


@router.post("/parse/image")
async def parse_image_route(file: UploadFile = File(...)) -> dict:
    if not settings.GLM_API_KEY:
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
    job_id = _new_job()
    asyncio.create_task(_run_image(job_id, data, mime))
    return {"job_id": job_id}


@router.get("/parse/job/{job_id}")
async def get_parse_job(job_id: str) -> dict:
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found or expired.")
    return job
