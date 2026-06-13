"""Summary routes: monthly category spend, per-platform charges, weekly digest."""
from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import asyncpg
from fastapi import APIRouter, Depends, Query

from .. import crud
from ..db import get_conn
from ..schemas import CategoriesSummary, ChargesSummary, WeeklySummary

router = APIRouter(tags=["summary"])

TZ = ZoneInfo("Asia/Kolkata")


def _current_month() -> str:
    return datetime.now(TZ).strftime("%Y-%m")


def _current_week_monday() -> str:
    today = datetime.now(TZ).date()
    monday = today - timedelta(days=today.weekday())
    return monday.isoformat()


@router.get("/summary/categories", response_model=CategoriesSummary)
async def category_summary(
    month: str | None = Query(None, description='"YYYY-MM"; defaults to current month'),
    conn: asyncpg.Connection = Depends(get_conn),
) -> CategoriesSummary:
    return await crud.category_summary(conn, month or _current_month())


@router.get("/summary/charges", response_model=ChargesSummary)
async def charge_summary(
    month: str | None = Query(None, description='"YYYY-MM"; defaults to current month'),
    conn: asyncpg.Connection = Depends(get_conn),
) -> ChargesSummary:
    return await crud.charge_summary(conn, month or _current_month())


@router.get("/summary/weekly", response_model=WeeklySummary)
async def weekly_summary(
    week_start: str | None = Query(
        None, description="Monday as YYYY-MM-DD; defaults to the current week"
    ),
    conn: asyncpg.Connection = Depends(get_conn),
) -> WeeklySummary:
    return await crud.weekly_summary(conn, week_start or _current_week_monday())
