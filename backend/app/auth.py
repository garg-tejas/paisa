"""Auth utilities: HMAC-signed tokens + FastAPI dependency.

No extra packages needed — uses stdlib base64 / hashlib / hmac / json / time.

Token format: base64url( JSON_payload || SHA-256_signature )
  - payload: {"exp": <unix timestamp>}
  - sig: HMAC-SHA256(payload, JWT_SECRET) — always 32 bytes, so slice is safe

If JWT_SECRET is not configured, require_auth is a no-op (all traffic passes).
This lets the app work before auth is set up, without a hard lockout.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings

_SIG_LEN = 32  # SHA-256 digest is always 32 bytes
_bearer = HTTPBearer(auto_error=False)


def _sign(payload: bytes) -> bytes:
    return hmac.new(settings.JWT_SECRET.encode(), payload, hashlib.sha256).digest()


def create_token(ttl_days: int = 30) -> str:
    payload = json.dumps({"exp": int(time.time()) + ttl_days * 86400}).encode()
    raw = payload + _sign(payload)
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def verify_token(token: str) -> bool:
    try:
        padded = token + "=" * (-len(token) % 4)
        raw = base64.urlsafe_b64decode(padded)
        if len(raw) <= _SIG_LEN:
            return False
        payload, sig = raw[:-_SIG_LEN], raw[-_SIG_LEN:]
        if not hmac.compare_digest(_sign(payload), sig):
            return False
        return int(time.time()) < json.loads(payload)["exp"]
    except Exception:
        return False


def require_auth(
    creds: HTTPAuthorizationCredentials | None = Security(_bearer),
) -> None:
    if not settings.JWT_SECRET:
        return  # auth not configured — allow all (useful during setup)
    if not creds or not verify_token(creds.credentials):
        raise HTTPException(status_code=401, detail="Not authenticated.")
