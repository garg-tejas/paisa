"""Budget routes: read monthly envelopes, and upsert one or many.

POST accepts either a single BudgetIn or a list of them, so the budgets screen
can save all 8 categories in one request.
"""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

import asyncpg
from fastapi import APIRouter, Body, Depends, Query

from .. import crud
from ..db import get_conn
from ..schemas import BudgetIn, BudgetOut

router = APIRouter(tags=["budgets"])

TZ = ZoneInfo("Asia/Kolkata")


def _current_month() -> str:
    return datetime.now(TZ).strftime("%Y-%m")


@router.get("/budgets", response_model=list[BudgetOut])
async def get_budgets(
    month: str | None = Query(None, description='"YYYY-MM"; defaults to current month'),
    conn: asyncpg.Connection = Depends(get_conn),
) -> list[BudgetOut]:
    return await crud.get_budgets(conn, month or _current_month())


@router.post("/budgets", response_model=list[BudgetOut])
async def set_budgets(
    body: BudgetIn | list[BudgetIn] = Body(...),
    conn: asyncpg.Connection = Depends(get_conn),
) -> list[BudgetOut]:
    budgets = body if isinstance(body, list) else [body]
    return await crud.upsert_budgets(conn, budgets)
