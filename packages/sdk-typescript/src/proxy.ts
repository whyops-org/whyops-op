/**
 * Proxy helpers — patch existing OpenAI / Anthropic client instances
 * so all calls route through the WhyOps proxy with the correct headers.
 *
 * The SDK does NOT import openai or @anthropic-ai/sdk.
 * It accepts whatever client the user already has and patches it.
 */

import { HEADERS } from './config.js';

// ─── OpenAI ─────────────────────────────────────────────────────────────────

/**
 * Patches an OpenAI client instance to route through the WhyOps proxy.
 *
 * @param client   An `new OpenAI(...)` instance
 * @param proxyUrl WhyOps proxy base URL
 * @param apiKey   WhyOps API key
 * @param agentName Agent name for X-Agent-Name header
 * @returns The same client, mutated in place
 */
export function patchOpenAI<T extends OpenAILike>(
  client: T,
  proxyUrl: string,
  apiKey: string,
  agentName: string,
): T {
  // The OpenAI SDK exposes `baseURL` as a settable property
  (client as any).baseURL = proxyUrl;

  // Replace the internal API key with the WhyOps key
  (client as any).apiKey = apiKey;

  // Inject default headers
  const existing = (client as any).defaultHeaders ?? {};
  (client as any).defaultHeaders = {
    ...existing,
    'Authorization': `Bearer ${apiKey}`,
    [HEADERS.agentName]: agentName,
  };

  return client;
}

/**
 * Patches an Anthropic client instance.
 *
 * @param client   An `new Anthropic(...)` instance
 * @param proxyUrl WhyOps proxy base URL
 * @param apiKey   WhyOps API key
 * @param agentName Agent name for X-Agent-Name header
 * @returns The same client, mutated in place
 */
export function patchAnthropic<T extends AnthropicLike>(
  client: T,
  proxyUrl: string,
  apiKey: string,
  agentName: string,
): T {
  (client as any).baseURL = proxyUrl;
  (client as any).apiKey = apiKey;

  const existing = (client as any).defaultHeaders ?? {};
  (client as any).defaultHeaders = {
    ...existing,
    [HEADERS.apiKeyAnthropic]: apiKey,
    [HEADERS.agentName]: agentName,
  };

  return client;
}

// ─── Minimal structural types (not importing the actual SDKs) ────────────────

interface OpenAILike {
  baseURL: string;
  [key: string]: unknown;
}

interface AnthropicLike {
  baseURL: string;
  [key: string]: unknown;
}
