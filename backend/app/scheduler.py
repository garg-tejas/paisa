"""APScheduler jobs (Asia/Kolkata).

Two recurring jobs, started from the FastAPI lifespan:

1. Hourly habit nudge — every hour on the hour, for each push subscription
   whose `notify_hour` matches the current local hour, send a "Log today's
   expenses" nudge UNLESS an order was already created after 18:00 local today
   (i.e. the user has clearly already logged for the evening).

2. Sunday 09:00 digest — send a weekly-summary push to every subscription.

Expired subscriptions surfaced by send_push (returns False) are pruned from
the database.
"""
from __future__ import annotations

import asyncio
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from . import crud
from .db import get_pool
from .push import send_push

TZ = ZoneInfo("Asia/Kolkata")

_scheduler: AsyncIOScheduler | None = None


def _safe_pool():
    """Return the live asyncpg pool, or None if init_db() hasn't run yet.

    Jobs may fire before/after the pool exists (startup races, shutdown); a
    missing pool simply means "nothing to do this tick".
    """
    try:
        return get_pool()
    except RuntimeError:
        return None


# --------------------------------------------------------------------------- #
# Subscription helpers                                                         #
# --------------------------------------------------------------------------- #
def _row_to_subscription(row) -> dict:
    """Build a Web Push subscription info dict from a push_subscriptions row."""
    return {
        "endpoint": row["endpoint"],
        "keys": {"p256dh": row["p256dh"], "auth": row["auth"]},
    }


async def _delete_subscription(conn, endpoint: str) -> None:
    await conn.execute(
        "DELETE FROM push_subscriptions WHERE endpoint = $1", endpoint
    )


async def _push_to(conn, row, payload: dict) -> bool:
    """Send to one subscription row; prune it if expired. Returns True if sent."""
    sub = _row_to_subscription(row)
    # send_push is blocking (network IO inside pywebpush); run off the loop.
    ok = await asyncio.to_thread(send_push, sub, payload)
    if not ok:
        await _delete_subscription(conn, row["endpoint"])
    return ok


# --------------------------------------------------------------------------- #
# Job: hourly habit nudge                                                      #
# --------------------------------------------------------------------------- #
async def hourly_nudge() -> int:
    """For subscriptions due this hour, nudge unless already logged tonight.

    Returns the number of nudges actually delivered (useful for tests/logs).
    """
    pool = _safe_pool()
    if pool is None:
        return 0

    now = datetime.now(TZ)
    current_hour = now.hour
    today = now.date()

    sent = 0
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT endpoint, p256dh, auth, notify_hour "
            "FROM push_subscriptions WHERE notify_hour = $1",
            current_hour,
        )
        if not rows:
            return 0

        # Skip the nudge entirely if the user has already logged an order after
        # 18:00 local today — they've clearly handled today's expenses.
        if await _logged_after_evening(conn, today):
            return 0

        payload = {
            "title": "paisa",
            "body": "Log today's expenses — a few taps now keeps the month honest.",
            "icon": "/icons/icon-192.png",
            "data": {"url": "/"},
        }
        for row in rows:
            if await _push_to(conn, row, payload):
                sent += 1
    return sent


async def _logged_after_evening(conn, today: date) -> bool:
    """True if any order was created after 18:00 local time today."""
    cutoff_local = datetime.combine(today, time(18, 0), tzinfo=TZ)
    cutoff_utc = cutoff_local.astimezone(ZoneInfo("UTC"))
    count = await conn.fetchval(
        "SELECT count(*) FROM orders WHERE created_at >= $1", cutoff_utc
    )
    return bool(count and count > 0)


# --------------------------------------------------------------------------- #
# Job: Sunday 09:00 weekly digest                                             #
# --------------------------------------------------------------------------- #
async def weekly_digest() -> int:
    """Send the weekly summary to every subscription. Returns count sent."""
    pool = _safe_pool()
    if pool is None:
        return 0

    now = datetime.now(TZ)
    # The week that just ended: Monday of the previous week.
    this_monday = now.date() - timedelta(days=now.weekday())
    last_monday = this_monday - timedelta(days=7)

    sent = 0
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT endpoint, p256dh, auth FROM push_subscriptions"
        )
        if not rows:
            return 0

        summary = await crud.weekly_summary(conn, last_monday.isoformat())
        body = _digest_body(summary)
        payload = {
            "title": "Your week in paisa",
            "body": body,
            "icon": "/icons/icon-192.png",
            "data": {"url": "/weekly"},
        }
        for row in rows:
            if await _push_to(conn, row, payload):
                sent += 1
    return sent


def _digest_body(summary) -> str:
    """Render a short human digest line from a WeeklySummary-shaped object."""
    total = _attr(summary, "total_spent", 0) or 0
    top = _attr(summary, "top_category", None)
    delta = _attr(summary, "delta_pct", 0) or 0

    parts = [f"You spent ₹{int(round(total)):,} last week."]
    if top:
        parts.append(f"Top: {top}.")
    if delta:
        arrow = "↑" if delta > 0 else "↓"
        parts.append(f"{arrow}{abs(int(round(delta)))}% vs the week before.")
    return " ".join(parts)


def _attr(obj, name: str, default):
    """Read either a dict key or an object attribute (crud may return either)."""
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


# --------------------------------------------------------------------------- #
# Lifecycle                                                                    #
# --------------------------------------------------------------------------- #
def start() -> AsyncIOScheduler:
    """Create, configure and start the scheduler. Idempotent."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    sched = AsyncIOScheduler(timezone=TZ)

    sched.add_job(
        hourly_nudge,
        trigger=CronTrigger(minute=0, timezone=TZ),
        id="hourly_nudge",
        replace_existing=True,
        misfire_grace_time=300,
        coalesce=True,
    )
    sched.add_job(
        weekly_digest,
        trigger=CronTrigger(day_of_week="sun", hour=9, minute=0, timezone=TZ),
        id="weekly_digest",
        replace_existing=True,
        misfire_grace_time=3600,
        coalesce=True,
    )

    sched.start()
    _scheduler = sched
    return sched


def shutdown() -> None:
    """Stop the scheduler (called from the FastAPI lifespan on shutdown)."""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
