"""
Proxy helpers — patch existing openai / anthropic client instances
so all calls route through the WhyOps proxy.

No imports of openai or anthropic. Accepts whatever the user has.
"""
from __future__ import annotations

from typing import Any, TypeVar

from ._config import HEADER_AGENT_NAME, HEADER_ANTHROPIC_KEY

T = TypeVar("T")


def patch_openai(client: T, proxy_url: str, api_key: str, agent_name: str) -> T:
    """
    Patch an openai.OpenAI (or AsyncOpenAI) client in place.

    Sets base_url, api_key, and default_headers so all calls route
    through the WhyOps proxy automatically.

    Example::

        import openai
        from whyops import WhyOps

        sdk = WhyOps(api_key="...", agent_name="my-agent", agent_metadata={...})
        client = sdk.openai(openai.OpenAI(api_key="whyops_..."))
    """
    obj: Any = client
    obj.base_url = proxy_url.rstrip("/")
    obj.api_key = api_key

    existing = getattr(obj, "default_headers", {}) or {}
    obj.default_headers = {
        **existing,
        "Authorization": f"Bearer {api_key}",
        HEADER_AGENT_NAME: agent_name,
    }
    return client


def patch_anthropic(client: T, proxy_url: str, api_key: str, agent_name: str) -> T:
    """
    Patch an anthropic.Anthropic (or AsyncAnthropic) client in place.

    Example::

        import anthropic
        from whyops import WhyOps

        sdk = WhyOps(api_key="...", agent_name="my-agent", agent_metadata={...})
        client = sdk.anthropic(anthropic.Anthropic(api_key="whyops_..."))
    """
    obj: Any = client
    obj.base_url = proxy_url.rstrip("/")
    obj.api_key = api_key

    existing = getattr(obj, "default_headers", {}) or {}
    obj.default_headers = {
        **existing,
        HEADER_ANTHROPIC_KEY: api_key,
        HEADER_AGENT_NAME: agent_name,
    }
    return client
