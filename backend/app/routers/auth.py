"""Authentication routes (public — no token required).

POST /auth/login  {username, password} -> {token}
"""
from __future__ import annotations

import secrets

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..auth import create_token
from ..config import settings

router = APIRouter(tags=["auth"])


class LoginIn(BaseModel):
    username: str
    password: str


@router.post("/auth/login")
async def login(body: LoginIn) -> dict:
    if not settings.JWT_SECRET or not settings.APP_USERNAME or not settings.APP_PASSWORD:
        raise HTTPException(
            status_code=503,
            detail="Auth not configured. Set APP_USERNAME, APP_PASSWORD, "
            "and JWT_SECRET in the environment.",
        )
    valid = secrets.compare_digest(
        body.username.encode(), settings.APP_USERNAME.encode()
    ) and secrets.compare_digest(
        body.password.encode(), settings.APP_PASSWORD.encode()
    )
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    return {"token": create_token()}
