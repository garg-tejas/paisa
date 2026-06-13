"""Item routes: edit (name / paid / category) and delete.

Editing an item's `paid` recomputes the parent order's totals; changing its
category is also stored as a learned correction (handled in crud).
"""
from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Response

from .. import crud
from ..db import get_conn
from ..schemas import ItemOut, ItemUpdate

router = APIRouter(tags=["items"])


@router.patch("/items/{item_id}", response_model=ItemOut)
async def update_item(
    item_id: str,
    patch: ItemUpdate,
    conn: asyncpg.Connection = Depends(get_conn),
) -> ItemOut:
    updated = await crud.update_item(conn, item_id, patch)
    if updated is None:
        raise HTTPException(status_code=404, detail="Item not found.")
    return updated


@router.delete("/items/{item_id}", status_code=204)
async def delete_item(
    item_id: str,
    conn: asyncpg.Connection = Depends(get_conn),
) -> Response:
    deleted = await crud.delete_item(conn, item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Item not found.")
    return Response(status_code=204)
