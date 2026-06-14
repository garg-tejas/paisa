"""paisa FastAPI application.

Lifespan: open the asyncpg pool + run migrations, start the scheduler; tear
both down on shutdown. Routers carry absolute paths (no extra prefix), matching
the frontend's API client.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import scheduler
from .auth import require_auth
from .config import settings
from .db import close_db, init_db
from .routers import auth, budgets, items, notifications, orders, parse, summary

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
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public routes (no token needed)
app.include_router(auth.router)

# Protected routes — require_auth is a no-op when JWT_SECRET is not configured.
_auth = [Depends(require_auth)]
app.include_router(parse.router, dependencies=_auth)
app.include_router(orders.router, dependencies=_auth)
app.include_router(items.router, dependencies=_auth)
app.include_router(summary.router, dependencies=_auth)
app.include_router(budgets.router, dependencies=_auth)
app.include_router(notifications.router, dependencies=_auth)


@app.get("/health", tags=["meta"])
async def health() -> dict:
    return {"status": "ok"}
