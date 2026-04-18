"""
Async PostgreSQL connection pool using asyncpg.
Reads the same DB as Node.js.
"""
from __future__ import annotations

import asyncpg
from typing import Any

from config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS, DATABASE_URL

_pool: asyncpg.Pool | None = None


async def init_pool(min_size: int = 2, max_size: int = 10) -> asyncpg.Pool:
    """Create the asyncpg connection pool (call once at startup)."""
    global _pool
    if _pool is not None:
        return _pool

    if DATABASE_URL:
        _pool = await asyncpg.create_pool(
            dsn=DATABASE_URL,
            min_size=min_size,
            max_size=max_size,
        )
    else:
        _pool = await asyncpg.create_pool(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            min_size=min_size,
            max_size=max_size,
        )
    return _pool


async def close_pool() -> None:
    """Gracefully close the pool (call on shutdown)."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    """Return the current pool. Raises if not initialized."""
    if _pool is None:
        raise RuntimeError("Database pool not initialized. Call init_pool() first.")
    return _pool


async def fetch_all(query: str, *args: Any) -> list[asyncpg.Record]:
    """Execute a query and return all rows."""
    pool = get_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(query, *args)


async def fetch_one(query: str, *args: Any) -> asyncpg.Record | None:
    """Execute a query and return a single row (or None)."""
    pool = get_pool()
    async with pool.acquire() as conn:
        return await conn.fetchrow(query, *args)
