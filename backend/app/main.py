"""paisa FastAPI application.

Lifespan: open the asyncpg pool + run migrations, start the scheduler; tear
both down on shutdown. Routers carry absolute paths (no extra prefix), matching
the frontend's API client.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import scheduler
from .config import settings
from .db import close_db, init_db
from .routers import budgets, items, notifications, orders, parse, summary

logger = logging.getLogger("paisa")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    try:
        scheduler.start()
    except Exception:  # noqa: BLE001 - never let the scheduler block boot
        logger.exception("Scheduler failed to start; continuing without it.")
    yield
    # Shutdown
    try:
        scheduler.shutdown()
    finally:
        await close_db()


app = FastAPI(
    title="paisa",
    description="Personal expense tracker API — parsing, summaries, budgets, push.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,  # no cookies/auth; wildcard origins are fine
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers (each defines its own absolute paths)
app.include_router(parse.router)
app.include_router(orders.router)
app.include_router(items.router)
app.include_router(summary.router)
app.include_router(budgets.router)
app.include_router(notifications.router)


@app.get("/health", tags=["meta"])
async def health() -> dict:
    return {"status": "ok"}
