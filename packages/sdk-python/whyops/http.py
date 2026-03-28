"""HTTP transport with retry/backoff using httpx (sync + async)."""
from __future__ import annotations

import asyncio
from typing import Any

import httpx

from ._config import (
    HEADER_CONTENT_TYPE_NAME,
    HEADER_CONTENT_TYPE_VALUE,
    HTTP_TIMEOUT_S,
    RETRY_DELAYS_S,
    RETRYABLE_STATUS_CODES,
)


def post_sync(url: str, body: dict[str, Any], headers: dict[str, str]) -> httpx.Response:
    merged = {HEADER_CONTENT_TYPE_NAME: HEADER_CONTENT_TYPE_VALUE, **headers}
    last_exc: Exception | None = None

    for attempt in range(len(RETRY_DELAYS_S) + 1):
        if attempt > 0:
            import time
            time.sleep(RETRY_DELAYS_S[attempt - 1])
        try:
            r = httpx.post(url, json=body, headers=merged, timeout=HTTP_TIMEOUT_S)
            if r.status_code not in RETRYABLE_STATUS_CODES:
                return r
            last_exc = Exception(f"HTTP {r.status_code}")
        except httpx.RequestError as exc:
            last_exc = exc

    raise last_exc or Exception("post_sync: unexpected failure")


async def post_async(url: str, body: dict[str, Any], headers: dict[str, str]) -> httpx.Response:
    merged = {HEADER_CONTENT_TYPE_NAME: HEADER_CONTENT_TYPE_VALUE, **headers}
    last_exc: Exception | None = None

    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_S) as client:
        for attempt in range(len(RETRY_DELAYS_S) + 1):
            if attempt > 0:
                await asyncio.sleep(RETRY_DELAYS_S[attempt - 1])
            try:
                r = await client.post(url, json=body, headers=merged)
                if r.status_code not in RETRYABLE_STATUS_CODES:
                    return r
                last_exc = Exception(f"HTTP {r.status_code}")
            except httpx.RequestError as exc:
                last_exc = exc

    raise last_exc or Exception("post_async: unexpected failure")
