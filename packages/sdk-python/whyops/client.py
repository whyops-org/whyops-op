from __future__ import annotations

from typing import Optional, TypeVar

from ._config import DEFAULT_ANALYSE_URL, DEFAULT_PROXY_URL
from .agent import AgentRegistry
from .proxy import patch_anthropic, patch_openai
from .trace import WhyOpsTrace
from .types import AgentInfo, AgentMetadata

T = TypeVar("T")


class WhyOps:
    """
    Main WhyOps client. Instantiate once per service/process.

    :param api_key:          Your WhyOps API key.
    :param agent_name:       Stable identifier for this agent (1–255 chars).
    :param agent_metadata:   System prompt, tools, and description.
    :param proxy_base_url:   Optional. Defaults to https://proxy.whyops.com
    :param analyse_base_url: Optional. Defaults to https://a.whyops.com/api

    Example::

        from whyops import WhyOps

        sdk = WhyOps(
            api_key=os.environ["WHYOPS_API_KEY"],
            agent_name="my-research-agent",
            agent_metadata={"systemPrompt": "You are a helpful assistant."},
        )
    """

    def __init__(
        self,
        api_key: str,
        agent_name: str,
        agent_metadata: AgentMetadata,
        proxy_base_url: str = "",
        analyse_base_url: str = "",
    ) -> None:
        self._api_key = api_key
        self._agent_name = agent_name
        self._agent_metadata = agent_metadata
        self._proxy_base_url = proxy_base_url or DEFAULT_PROXY_URL
        self._analyse_base_url = analyse_base_url or DEFAULT_ANALYSE_URL
        self._registry = AgentRegistry(api_key, self._proxy_base_url, self._analyse_base_url)

    # ─── Agent init ──────────────────────────────────────────────────────────

    def init_agent_sync(self) -> Optional[AgentInfo]:
        """Synchronously initialise the agent. Called automatically by trace methods."""
        return self._registry.ensure_sync(self._agent_name, self._agent_metadata)

    async def init_agent(self) -> Optional[AgentInfo]:
        """Asynchronously initialise the agent. Called automatically by trace methods."""
        return await self._registry.ensure_async(self._agent_name, self._agent_metadata)

    # ─── Trace ───────────────────────────────────────────────────────────────

    def trace(self, trace_id: str) -> WhyOpsTrace:
        """
        Create a trace builder for a session or conversation.

        :param trace_id: Your session/conversation identifier.
        """
        return WhyOpsTrace(
            trace_id=trace_id,
            agent_name=self._agent_name,
            api_key=self._api_key,
            analyse_base_url=self._analyse_base_url,
            on_init_sync=lambda: self.init_agent_sync(),
            on_init_async=self.init_agent,
        )

    # ─── Proxy helpers ───────────────────────────────────────────────────────

    def openai(self, client: T) -> T:
        """Patch an openai client to route through the WhyOps proxy."""
        return patch_openai(client, self._proxy_base_url, self._api_key, self._agent_name)

    def anthropic(self, client: T) -> T:
        """Patch an anthropic client to route through the WhyOps proxy."""
        return patch_anthropic(client, self._proxy_base_url, self._api_key, self._agent_name)
