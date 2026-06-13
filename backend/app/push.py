"""Web Push delivery via pywebpush + VAPID.

This module sends a single push message to a single subscription. Expired
subscriptions (HTTP 404/410) are swallowed gracefully so callers do not need
to special-case them; everything else propagates.
"""
from __future__ import annotations

import json
from typing import Any

from pywebpush import WebPushException, webpush

from .config import settings


def _vapid_claims() -> dict[str, str]:
    """Standard VAPID claims. `sub` must be a mailto: (or https:) URL."""
    return {"sub": f"mailto:{settings.VAPID_EMAIL}"}


def send_push(subscription: dict[str, Any], payload: dict[str, Any]) -> bool:
    """Send `payload` (a JSON-serialisable dict) to one push `subscription`.

    `subscription` must be a standard Web Push subscription info dict:
        {"endpoint": str, "keys": {"p256dh": str, "auth": str}}

    Returns True if the push was accepted by the push service, False if the
    subscription is expired/gone (404/410) and should be pruned by the caller.
    Re-raises any other WebPushException so genuine failures are visible.
    """
    try:
        webpush(
            subscription_info=subscription,
            data=json.dumps(payload),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims=_vapid_claims(),
            ttl=86400,
        )
        return True
    except WebPushException as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status in (404, 410):
            # Subscription is gone/expired — swallow so the scheduler/test
            # endpoint can carry on with the remaining subscriptions.
            return False
        # Any other error (400/401/413/5xx, network, etc.) is a real problem.
        raise
