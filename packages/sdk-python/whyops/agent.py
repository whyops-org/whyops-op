from __future__ import annotations

import json
import sys
from typing import Optional

from ._config import (
    ENDPOINT_AGENT_INIT_FALLBACK,
    ENDPOINT_AGENT_INIT_PRIMARY,
    LOG_PREFIX,
)
from .http import post_async, post_sync
from .types import AgentInfo, AgentMetadata


def _stable_key(agent_name: str, metadata: AgentMetadata) -> str:
    return f"{agent_name}:{json.dumps(metadata, sort_keys=True)}"


class AgentRegistry:
    def __init__(self, api_key: str, proxy_base_url: str, analyse_base_url: str) -> None:
        self._api_key = api_key
        self._proxy_base_url = proxy_base_url.rstrip("/")
        self._analyse_base_url = analyse_base_url.rstrip("/")
        self._cache: dict[str, AgentInfo] = {}

    def _urls(self) -> list[str]:
        return [
            f"{self._analyse_base_url}{ENDPOINT_AGENT_INIT_PRIMARY}",
            f"{self._proxy_base_url}{ENDPOINT_AGENT_INIT_FALLBACK}",
        ]

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._api_key}"}

    def _body(self, agent_name: str, metadata: AgentMetadata) -> dict:
        m = {"tools": [], **dict(metadata)}
        return {"agentName": agent_name, "metadata": m}

    # ── Sync ─────────────────────────────────────────────────────────────────

    def ensure_sync(self, agent_name: str, metadata: AgentMetadata) -> Optional[AgentInfo]:
        key = _stable_key(agent_name, metadata)
        if key in self._cache:
            return self._cache[key]
        info = self._init_sync(agent_name, metadata)
        if info:
            self._cache[key] = info
        return info

    def _init_sync(self, agent_name: str, metadata: AgentMetadata) -> Optional[AgentInfo]:
        body = self._body(agent_name, metadata)
        headers = self._headers()
        for url in self._urls():
            try:
                r = post_sync(url, body, headers)
                if r.is_success:
                    data = r.json()
                    if data.get("agentId"):
                        return AgentInfo(
                            agentId=data["agentId"],
                            agentVersionId=data["agentVersionId"],
                            status=data["status"],
                            versionHash=data["versionHash"],
                        )
            except Exception:
                pass
        print(f"{LOG_PREFIX} agent init failed — continuing without registration", file=sys.stderr)
        return None

    # ── Async ────────────────────────────────────────────────────────────────

    async def ensure_async(self, agent_name: str, metadata: AgentMetadata) -> Optional[AgentInfo]:
        key = _stable_key(agent_name, metadata)
        if key in self._cache:
            return self._cache[key]
        info = await self._init_async(agent_name, metadata)
        if info:
            self._cache[key] = info
        return info

    async def _init_async(self, agent_name: str, metadata: AgentMetadata) -> Optional[AgentInfo]:
        body = self._body(agent_name, metadata)
        headers = self._headers()
        for url in self._urls():
            try:
                r = await post_async(url, body, headers)
                if r.is_success:
                    data = r.json()
                    if data.get("agentId"):
                        return AgentInfo(
                            agentId=data["agentId"],
                            agentVersionId=data["agentVersionId"],
                            status=data["status"],
                            versionHash=data["versionHash"],
                        )
            except Exception:
                pass
        print(f"{LOG_PREFIX} agent init failed — continuing without registration", file=sys.stderr)
        return None
