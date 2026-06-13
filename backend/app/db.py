"""Database layer: asyncpg connection pool, migrations, and the FastAPI
`get_conn` dependency.

The pool is created lazily on startup (`init_db`) and shared process-wide.
SSL is enabled automatically for managed hosts (Neon / others that require it).
`init_db` is idempotent — it runs migrations/001_init.sql, which itself uses
CREATE ... IF NOT EXISTS everywhere.
"""

from __future__ import annotations

import ssl
from pathlib import Path
from typing import AsyncIterator

import asyncpg

from app.config import settings

# Process-wide pool. Populated by init_db(), torn down by close_db().
_pool: asyncpg.Pool | None = None

# migrations/ lives at backend/migrations relative to this file
# (this file is backend/app/db.py -> parents[1] == backend/).
_MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "migrations"


def _needs_ssl(dsn: str) -> bool:
    """Heuristic: managed Postgres (Neon etc.) needs TLS; localhost does not.

    Honors an explicit `sslmode` in the DSN when present.
    """
    lowered = dsn.lower()
    if "sslmode=disable" in lowered:
        return False
    if "sslmode=require" in lowered or "sslmode=verify" in lowered:
        return True
    # Default: require SSL unless clearly a local connection.
    if "localhost" in lowered or "127.0.0.1" in lowered or "@db:" in lowered:
        return False
    return True


def _ssl_context(dsn: str) -> ssl.SSLContext | bool:
    """Build an SSL context for asyncpg, or False when SSL is not needed."""
    if not _needs_ssl(dsn):
        return False
    # Neon presents a valid public cert; a default context verifies it.
    ctx = ssl.create_default_context()
    return ctx


async def init_db() -> None:
    """Create the connection pool and run migrations. Idempotent."""
    global _pool
    if _pool is not None:
        return

    _pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        ssl=_ssl_context(settings.DATABASE_URL),
        min_size=1,
        max_size=10,
        command_timeout=60,
    )

    await _run_migrations()


async def _run_migrations() -> None:
    """Execute every *.sql file in migrations/ in lexical order."""
    assert _pool is not None
    if not _MIGRATIONS_DIR.exists():
        return

    sql_files = sorted(_MIGRATIONS_DIR.glob("*.sql"))
    async with _pool.acquire() as conn:
        for sql_file in sql_files:
            sql = sql_file.read_text(encoding="utf-8")
            if sql.strip():
                await conn.execute(sql)


async def close_db() -> None:
    """Close the pool on shutdown."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    """Return the live pool (raises if init_db has not run)."""
    if _pool is None:
        raise RuntimeError("Database pool not initialized; call init_db() first.")
    return _pool


async def get_conn() -> AsyncIterator[asyncpg.Connection]:
    """FastAPI dependency: yield a pooled connection, returned automatically."""
    pool = get_pool()
    async with pool.acquire() as conn:
        yield conn
