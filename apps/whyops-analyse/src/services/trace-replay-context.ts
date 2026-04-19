import { LLMEvent, Provider, Trace } from '@whyops/shared/models';
import type { ReplayVariantConfig } from '@whyops/shared/models';
import { createServiceLogger } from '@whyops/shared/logger';
import { decrypt } from '@whyops/shared/utils';

const logger = createServiceLogger('analyse:trace-replay-context');

export interface RecordedToolOutput {
  toolName: string;
  output: any;
  stepId: number;
}

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ReplayContext {
  traceId: string;
  agentName: string;
  /** System prompt with variant patches applied */
  systemPrompt: string;
  /** Tool definitions with variant patches applied */
  tools: any[];
  /** Initial user message text extracted from the first user_message event */
  initialUserMessage: string;
  /** Ordered queue of recorded tool outputs keyed by tool name */
  recordedOutputs: Map<string, RecordedToolOutput[]>;
  originalEvents: LLMEvent[];
  /** The real provider the original trace used — used to drive the replay LLM */
  provider: ProviderConfig | null;
}

function tryParseJson(value: string): any {
  try { return JSON.parse(value); } catch { return value; }
}

function extractText(content: any): string {
  // Unwrap if content is a serialized JSON string
  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      content = tryParseJson(trimmed);
    } else {
      return content;
    }
  }
  if (Array.isArray(content)) {
    for (let i = content.length - 1; i >= 0; i--) {
      const item = content[i];
      if (!item || typeof item !== 'object') continue;
      if (item.role === 'user') {
        const extracted = extractInnerContent(item.content);
        if (extracted) return extracted;
        break;
      }
    }
    // Fallback: last message text
    const last = content[content.length - 1];
    const fallback = last ? extractInnerContent(last.content) : '';
    if (fallback) return fallback;
  }
  if (content && typeof content === 'object') {
    return extractInnerContent(content) || JSON.stringify(content).slice(0, 500);
  }
  return '';
}

/** Extract text from a message content field (string, array of parts, or {content,parts} object) */
function extractInnerContent(c: any): string {
  if (!c) return '';
  if (typeof c === 'string') {
    // Try to parse as JSON — the content may be a JSON-encoded object/array
    const trimmed = c.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const parsed = tryParseJson(trimmed);
      if (parsed !== c) return extractInnerContent(parsed);
    }
    return c;
  }
  if (Array.isArray(c)) {
    return c
      .filter((p: any) => p?.type === 'text' || p?.type === 'input_text')
      .map((p: any) => p.text ?? p.input_text ?? '')
      .join(' ')
      .trim();
  }
  if (typeof c === 'object') {
    // {content: "text"} or {parts: [...]}
    if (typeof c.content === 'string' && c.content.trim()) return c.content;
    if (Array.isArray(c.parts)) {
      return c.parts
        .filter((p: any) => p?.type === 'text' || p?.type === 'input_text')
        .map((p: any) => p.text ?? p.input_text ?? '')
        .join(' ')
        .trim();
    }
    if (typeof c.text === 'string') return c.text;
  }
  return '';
}

function extractToolOutput(event: LLMEvent): any {
  const c = event.content as any;
  if (!c) return null;
  // tool_call_response has toolResults
  if (c.toolResults !== undefined) return c.toolResults;
  // tool_result is the raw output passed back to LLM
  if (c.output !== undefined) return c.output;
  if (c.result !== undefined) return c.result;
  return c;
}

function applyToolDescriptionPatches(
  tools: any[],
  patches: Record<string, string>
): any[] {
  if (!tools || !patches || Object.keys(patches).length === 0) return tools;
  return tools.map((tool) => {
    const name = tool?.name ?? tool?.function?.name;
    if (name && patches[name]) {
      return { ...tool, description: patches[name] };
    }
    return tool;
  });
}

export async function buildReplayContext(
  traceId: string,
  userId: string,
  variantConfig: ReplayVariantConfig
): Promise<ReplayContext> {
  const trace = await Trace.findOne({
    where: { id: traceId, userId },
    attributes: ['id', 'entityId', 'systemMessage', 'tools', 'metadata', 'providerId'],
  });

  if (!trace) throw new Error(`TRACE_NOT_FOUND: ${traceId}`);

  const events = await LLMEvent.findAll({
    where: { traceId, userId },
    attributes: ['id', 'stepId', 'eventType', 'content', 'metadata', 'timestamp'],
    order: [['step_id', 'ASC'], ['timestamp', 'ASC']],
  });

  if (events.length === 0) throw new Error(`TRACE_HAS_NO_EVENTS: ${traceId}`);

  // Resolve agent name from metadata
  const agentName = (trace.metadata as any)?.agentName ?? 'unknown-agent';

  // System prompt: prefer variantConfig override, else original
  const systemPrompt = variantConfig.systemPrompt ?? (trace.systemMessage || '');

  // Tools: use injected tools if provided, else trace tools; then apply description patches
  const baseTools: any[] = Array.isArray(variantConfig.tools) && variantConfig.tools.length > 0
    ? variantConfig.tools
    : Array.isArray(trace.tools) ? trace.tools : [];
  const tools = applyToolDescriptionPatches(baseTools, variantConfig.toolDescriptions ?? {});

  // Extract initial user message
  const firstUserEvent = events.find((e) => e.eventType === 'user_message');
  const initialUserMessage = firstUserEvent ? extractText(firstUserEvent.content) : '';

  if (!initialUserMessage) {
    logger.warn({ traceId }, 'No user message found in trace for replay');
  }

  // Build ordered tool output queues keyed by tool name
  const recordedOutputs = new Map<string, RecordedToolOutput[]>();

  for (const event of events) {
    if (event.eventType !== 'tool_call_response' && event.eventType !== 'tool_result') continue;

    const toolName =
      (event.metadata as any)?.tool ??
      (event.content as any)?.function?.name ??
      'unknown_tool';

    const output = extractToolOutput(event);
    if (output === null) continue;

    const list = recordedOutputs.get(toolName) ?? [];
    list.push({ toolName, output, stepId: event.stepId });
    recordedOutputs.set(toolName, list);
  }

  // Resolve the original provider so the replay uses the same model + credentials
  let provider: ProviderConfig | null = null;
  const traceProviderId = (trace as any).providerId ?? (trace.toJSON() as any).provider_id;
  const traceModel = (trace.metadata as any)?.model ?? null;

  if (traceProviderId) {
    const providerRow = await Provider.findOne({
      where: { id: traceProviderId },
      attributes: ['baseUrl', 'apiKey', 'metadata'],
    });
    if (providerRow) {
      const rawKey = providerRow.apiKey;
      let apiKey = rawKey;
      try {
        const decrypted = decrypt(rawKey);
        // Only use decrypted value if it contains only printable ASCII (same check as proxy)
        const isPrintableAscii = decrypted.length >= 8 &&
          [...decrypted].every(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126);
        if (isPrintableAscii) apiKey = decrypted;
      } catch { /* not encrypted — use raw */ }
      provider = {
        baseUrl: providerRow.baseUrl,
        apiKey,
        model: traceModel ?? (providerRow.metadata as any)?.defaultModel ?? 'gpt-4o',
      };
    }
  }

  if (!provider) {
    logger.warn({ traceId, traceProviderId }, 'No provider found for trace — replay will use judge LLM as fallback');
  }

  logger.info(
    {
      traceId,
      toolCount: tools.length,
      recordedOutputKeys: [...recordedOutputs.keys()],
      providerBaseUrl: provider?.baseUrl ?? 'judge-fallback',
      replayModel: provider?.model ?? 'judge-fallback',
    },
    'Replay context built'
  );

  return {
    traceId,
    agentName,
    systemPrompt,
    tools,
    initialUserMessage,
    recordedOutputs,
    originalEvents: events,
    provider,
  };
}
