"""Order routes: create, list, fetch, delete."""
from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, Response

from .. import crud
from ..db import get_conn
from ..schemas import OrderListItem, OrderOut, ParsedOrder

router = APIRouter(tags=["orders"])


@router.post("/orders", response_model=OrderOut, status_code=201)
async def create_order(
    order: ParsedOrder,
    conn: asyncpg.Connection = Depends(get_conn),
) -> OrderOut:
    """Persist a confirmed order with its items and charges."""
    if not order.items:
        raise HTTPException(status_code=400, detail="An order needs at least one item.")
    return await crud.create_order(conn, order)


@router.get("/orders", response_model=list[OrderListItem])
async def list_orders(
    start: str | None = Query(None, description="ISO date lower bound (inclusive)"),
    end: str | None = Query(None, description="ISO date upper bound (inclusive)"),
    platform: str | None = Query(None),
    conn: asyncpg.Connection = Depends(get_conn),
) -> list[OrderListItem]:
    return await crud.list_orders(conn, start, end, platform)


@router.get("/orders/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: str,
    conn: asyncpg.Connection = Depends(get_conn),
) -> OrderOut:
    order = await crud.get_order(conn, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found.")
    return order


@router.delete("/orders/{order_id}", status_code=204)
async def delete_order(
    order_id: str,
    conn: asyncpg.Connection = Depends(get_conn),
) -> Response:
    deleted = await crud.delete_order(conn, order_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Order not found.")
    return Response(status_code=204)
