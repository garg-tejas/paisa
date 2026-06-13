"""Push-notification routes.

POST /notifications/subscribe  -> upsert a Web Push subscription.
POST /notifications/test       -> fan out a test push to every subscription.

Paths are absolute (no router prefix) per the project contract.
"""
from __future__ import annotations

import asyncio

import asyncpg
from fastapi import APIRouter, Depends

from ..db import get_conn
from ..push import send_push
from ..schemas import PushSubscriptionIn

router = APIRouter(tags=["notifications"])


@router.post("/notifications/subscribe")
async def subscribe(
    body: PushSubscriptionIn,
    conn: asyncpg.Connection = Depends(get_conn),
) -> dict:
    """Upsert a push subscription, keyed by its unique endpoint.

    `body.keys` carries the browser-supplied p256dh & auth secrets.
    """
    p256dh = body.keys.get("p256dh", "")
    auth = body.keys.get("auth", "")

    await conn.execute(
        """
        INSERT INTO push_subscriptions (endpoint, p256dh, auth, notify_hour)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (endpoint) DO UPDATE
            SET p256dh = EXCLUDED.p256dh,
                auth = EXCLUDED.auth,
                notify_hour = EXCLUDED.notify_hour
        """,
        body.endpoint,
        p256dh,
        auth,
        body.notify_hour,
    )
    return {"ok": True}


@router.post("/notifications/test")
async def test_push(conn: asyncpg.Connection = Depends(get_conn)) -> dict:
    """Send a test notification to all subscriptions; prune expired ones.

    Returns {"sent": <number actually delivered>}.
    """
    rows = await conn.fetch(
        "SELECT endpoint, p256dh, auth FROM push_subscriptions"
    )

    payload = {
        "title": "paisa",
        "body": "Test notification — push is working \U0001F389",
        "icon": "/icons/icon-192.png",
        "data": {"url": "/"},
    }

    sent = 0
    for row in rows:
        subscription = {
            "endpoint": row["endpoint"],
            "keys": {"p256dh": row["p256dh"], "auth": row["auth"]},
        }
        # send_push does blocking network IO inside pywebpush; offload it.
        ok = await asyncio.to_thread(send_push, subscription, payload)
        if ok:
            sent += 1
        else:
            # Expired (404/410) — remove so we stop trying.
            await conn.execute(
                "DELETE FROM push_subscriptions WHERE endpoint = $1",
                row["endpoint"],
            )

    return {"sent": sent}
