import type { CodeSnippetConfig, CodeSnippetData } from "./types";

type ProviderKey = "openai" | "anthropic";

interface ProviderDefaults {
  provider: ProviderKey;
  directModel: string;
  runtimeModel: string;
  prompt: string;
  reply: string;
  tool: string;
}

const PROVIDER_DEFAULTS: Record<ProviderKey, ProviderDefaults> = {
  openai: {
    provider: "openai",
    directModel: "gpt-4o",
    runtimeModel: "openai/gpt-4o-mini",
    prompt: "Where is order 123?",
    reply: "Your order has shipped.",
    tool: "search_orders",
  },
  anthropic: {
    provider: "anthropic",
    directModel: "claude-3-5-sonnet-20241022",
    runtimeModel: "anthropic/claude-3-5-sonnet-20241022",
    prompt: "Summarize this incident.",
    reply: "Here is the incident summary.",
    tool: "lookup_incident",
  },
};

export function getProviderDefaults(providerSlug: string): ProviderDefaults {
  return providerSlug === "anthropic" ? PROVIDER_DEFAULTS.anthropic : PROVIDER_DEFAULTS.openai;
}

export function getSnippetValues(data: CodeSnippetData, config: CodeSnippetConfig) {
  const provider = getProviderDefaults(data.providerSlug);
  return {
    agentName: "customer-support-agent",
    analyseBaseUrl: config.analyseBaseUrl.replace(/\/$/, ""),
    apiKey: data.apiKey,
    externalUserId: "user_12345",
    prompt: provider.prompt,
    provider: provider.provider,
    proxyBaseUrl: config.proxyBaseUrl.replace(/\/$/, ""),
    reply: provider.reply,
    runtimeModel: provider.runtimeModel,
    tool: provider.tool,
    traceId: "session-123",
    directModel: provider.directModel,
  };
}

export function fillTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (output, [key, value]) => output.replaceAll(`{{${key}}}`, value),
    template.trim()
  );
}
