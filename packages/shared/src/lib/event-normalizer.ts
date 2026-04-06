/**
 * Server-side event content normalizer.
 *
 * Strips raw OpenAI/Anthropic API request/response payloads (which embed full
 * conversation history, tool schemas, and boilerplate) down to the meaningful
 * delta for the event type. Ported from the frontend trace-event-parsers and
 * runs at ingestion time so the DB stores canonical shapes, not raw payloads.
 *
 * Canonical shapes per event type:
 *   user_message     → string (extracted user text only)
 *   system_message   → string (extracted system prompt text)
 *   llm_response     → { text?, toolCalls?, finishReason? }
 *   tool_call_request → { id?, name, arguments? }
 *   tool_call_response → { tool_call_id?, content? } | { callId?, result? }
 *   embedding_request / embedding_response / llm_thinking / error → pass-through
 */

export interface NormalizedToolCall {
  id?: string;
  name: string;
  arguments?: string;
}

export interface NormalizedLlmResponse {
  text?: string;
  toolCalls?: NormalizedToolCall[];
  finishReason?: string;
}

export type NormalizedContent = string | NormalizedLlmResponse | Record<string, unknown> | unknown;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function tryParseStructuredText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return text;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === 'string') return parsed;
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => (typeof entry === 'string' ? entry : ''))
        .filter((entry) => entry.length > 0)
        .join('\n');
    }
    if (isRecord(parsed)) {
      if (typeof parsed.content === 'string') return parsed.content;
      if (Array.isArray(parsed.parts)) {
        return (parsed.parts as unknown[])
          .map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
          .filter((t) => t.length > 0)
          .join('\n');
      }
    }
  } catch {
    // fall through
  }
  return text;
}

function extractChatText(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return tryParseStructuredText(content);
  if (Array.isArray(content)) {
    return (content as unknown[])
      .map((part) => {
        if (!isRecord(part)) return '';
        if (part.type === 'text' && typeof part.text === 'string') return part.text;
        if (part.type === 'input_text' && typeof part.text === 'string') return part.text;
        return '';
      })
      .filter((t) => t.length > 0)
      .map((t) => tryParseStructuredText(t))
      .join('\n');
  }
  if (isRecord(content)) {
    if (typeof content.content === 'string' || Array.isArray(content.content)) {
      return extractChatText(content.content);
    }
    if (typeof content.text === 'string') return tryParseStructuredText(content.text);
    if (typeof content.message === 'string') return tryParseStructuredText(content.message);
  }
  return safeStringify(content);
}

function extractInputMessageText(messages: unknown[], role: string): string {
  if (!Array.isArray(messages)) return '';
  const matching = messages.filter((m) => isRecord(m) && m.role === role);
  const candidates = (matching.length > 0 ? matching : messages) as unknown[];
  return candidates
    .map((msg) => {
      if (!isRecord(msg)) return '';
      if (typeof msg.content === 'string') return msg.content;
      if (Array.isArray(msg.content)) {
        return (msg.content as unknown[])
          .map((part) => (isRecord(part) && part.type === 'input_text' && typeof part.text === 'string' ? part.text : ''))
          .filter((t) => t.length > 0)
          .join('\n');
      }
      return '';
    })
    .filter((t) => t.length > 0)
    .map((t) => tryParseStructuredText(t))
    .join('\n');
}

function extractChatToolCalls(message: unknown): NormalizedToolCall[] {
  if (!isRecord(message)) return [];
  const toolCalls = message.tool_calls;
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return [];
  return toolCalls
    .filter((call) => isRecord(call) && isRecord(call.function) && typeof call.function.name === 'string')
    .map((call) => ({
      id: typeof call.id === 'string' ? call.id : undefined,
      name: (call.function as Record<string, unknown>).name as string,
      arguments: typeof (call.function as Record<string, unknown>).arguments === 'string'
        ? ((call.function as Record<string, unknown>).arguments as string)
        : undefined,
    }));
}

function extractResponsesOutputText(output?: unknown[], outputText?: string | null): string {
  if (!Array.isArray(output)) return outputText ?? '';
  const segments: string[] = [];
  for (const item of output) {
    if (!isRecord(item)) continue;
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const part of item.content as unknown[]) {
        if (!isRecord(part)) continue;
        if (part.type === 'output_text' && typeof part.text === 'string') segments.push(part.text);
        if (part.type === 'refusal' && typeof part.refusal === 'string') segments.push(part.refusal);
        if (part.type === 'output_audio' && typeof part.transcript === 'string') segments.push(part.transcript);
      }
    }
    if (item.type === 'reasoning' && Array.isArray(item.summary)) {
      for (const s of item.summary as unknown[]) {
        if (isRecord(s) && typeof s.text === 'string') segments.push(s.text);
      }
    }
  }
  if (segments.length === 0 && outputText) segments.push(outputText);
  return segments.join('\n');
}

function extractResponsesToolCalls(output?: unknown[]): NormalizedToolCall[] {
  if (!Array.isArray(output)) return [];
  const calls: NormalizedToolCall[] = [];
  for (const item of output) {
    if (!isRecord(item)) continue;
    if (item.type === 'function_call' && typeof item.name === 'string') {
      calls.push({
        id: typeof item.call_id === 'string' ? item.call_id : typeof item.id === 'string' ? item.id : undefined,
        name: item.name,
        arguments: typeof item.arguments === 'string' ? item.arguments : undefined,
      });
    } else if (item.type === 'web_search_call') {
      calls.push({ id: typeof item.id === 'string' ? item.id : undefined, name: 'web_search', arguments: item.action ? safeStringify(item.action) : undefined });
    } else if (item.type === 'file_search_call') {
      calls.push({ id: typeof item.id === 'string' ? item.id : undefined, name: 'file_search', arguments: Array.isArray(item.queries) ? safeStringify(item.queries) : undefined });
    } else if (item.type === 'code_interpreter_call') {
      calls.push({ id: typeof item.id === 'string' ? item.id : undefined, name: 'code_interpreter', arguments: typeof item.code === 'string' ? item.code : undefined });
    } else if (item.type === 'computer_call') {
      calls.push({ id: typeof item.id === 'string' ? item.id : undefined, name: 'computer', arguments: item.action ? safeStringify(item.action) : undefined });
    }
  }
  return calls;
}

function extractToolCallFromContent(content: unknown, toolCallIdHint?: string): NormalizedToolCall | null {
  if (!content) return null;

  if (isRecord(content) && content.type === 'function' && isRecord(content.function) && typeof content.function.name === 'string') {
    return {
      id: typeof content.id === 'string' ? content.id : toolCallIdHint,
      name: content.function.name,
      arguments: typeof content.function.arguments === 'string' ? content.function.arguments : undefined,
    };
  }

  if (isRecord(content) && content.type === 'function_call' && typeof content.name === 'string') {
    return {
      id: typeof content.call_id === 'string' ? content.call_id : typeof content.id === 'string' ? content.id : toolCallIdHint,
      name: content.name,
      arguments: typeof content.arguments === 'string' ? content.arguments : undefined,
    };
  }

  if (isRecord(content) && Array.isArray(content.tool_calls)) {
    const matches = content.tool_calls as unknown[];
    const selected = toolCallIdHint
      ? matches.find((c) => isRecord(c) && c.id === toolCallIdHint)
      : matches[0];
    if (isRecord(selected) && isRecord(selected.function) && typeof selected.function.name === 'string') {
      return {
        id: typeof selected.id === 'string' ? selected.id : toolCallIdHint,
        name: selected.function.name,
        arguments: typeof selected.function.arguments === 'string' ? selected.function.arguments : undefined,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Provider detection
// ---------------------------------------------------------------------------

function detectProvider(metadata?: Record<string, unknown>): 'openai' | 'anthropic' | 'unknown' {
  if (!metadata) return 'unknown';
  const provider = metadata.provider ?? metadata.providerSlug ?? metadata.providerName;
  if (typeof provider !== 'string') return 'unknown';
  const n = provider.toLowerCase();
  if (n.includes('anthropic')) return 'anthropic';
  if (n.includes('openai') || n.includes('openrouter')) return 'openai';
  return 'unknown';
}

function looksLikeOpenAiContent(content: unknown): boolean {
  if (!content) return false;
  if (isRecord(content)) {
    if (content.object === 'chat.completion' || content.object === 'chat.completion.chunk' || content.object === 'response') return true;
    if (typeof content.type === 'string' && content.type.startsWith('response.')) return true;
    if ('messages' in content && 'model' in content) return true;
    if ('input' in content && 'model' in content) return true;
    if ('role' in content && 'content' in content) return true;
    if ('choices' in content) return true;
    if (isRecord(content.response) && typeof (content.response as Record<string, unknown>).role === 'string') return true;
  }
  if (Array.isArray(content)) {
    const first = content[0];
    return isRecord(first) && 'role' in first && 'content' in first;
  }
  return false;
}

function looksLikeAnthropicContent(content: unknown): boolean {
  if (!content) return false;
  return isRecord(content) && content.type === 'message';
}

// ---------------------------------------------------------------------------
// OpenAI normalization
// ---------------------------------------------------------------------------

function normalizeOpenAiUserMessage(content: unknown, metadata?: Record<string, unknown>): NormalizedContent {
  if (isRecord(content) && Array.isArray(content.messages)) {
    const userMessages = (content.messages as unknown[]).filter((m) => isRecord(m) && m.role === 'user');
    const text = userMessages.map((m) => extractChatText((m as Record<string, unknown>).content)).filter((t) => t.length > 0).join('\n');
    return text || content;
  }
  if (isRecord(content) && 'input' in content) {
    const input = content.input;
    if (typeof input === 'string') return tryParseStructuredText(input);
    if (Array.isArray(input)) return extractInputMessageText(input, 'user') || content;
  }
  if (Array.isArray(content)) {
    return (content as unknown[]).filter((m) => isRecord(m) && m.role === 'user').map((m) => extractChatText((m as Record<string, unknown>).content)).filter((t) => t.length > 0).join('\n') || content;
  }
  if (isRecord(content) && content.role === 'user') {
    return extractChatText(content.content) || content;
  }
  return content;
}

function normalizeOpenAiSystemMessage(content: unknown): NormalizedContent {
  if (isRecord(content) && Array.isArray(content.messages)) {
    const sysMessages = (content.messages as unknown[]).filter((m) => isRecord(m) && (m.role === 'system' || m.role === 'developer'));
    return sysMessages.map((m) => extractChatText((m as Record<string, unknown>).content)).filter((t) => t.length > 0).join('\n') || content;
  }
  if (isRecord(content) && (content.role === 'system' || content.role === 'developer')) {
    return extractChatText(content.content) || content;
  }
  return content;
}

function normalizeOpenAiLlmResponse(content: unknown): NormalizedContent {
  if (!content) return content;

  // Nested response envelope: { response: { role, content, ... } }
  if (isRecord(content) && isRecord(content.response) && typeof (content.response as Record<string, unknown>).role === 'string') {
    const response = content.response as Record<string, unknown>;
    const text = extractChatText(response.content);
    return {
      text: text || undefined,
      finishReason: response.finished === true ? 'completed' : undefined,
    };
  }

  // chat.completion
  if (isRecord(content) && (content.object === 'chat.completion' || ('choices' in content && !('object' in content)))) {
    const choices = content.choices as unknown[] | undefined;
    const choice = Array.isArray(choices) ? choices[0] : undefined;
    const message = isRecord(choice) ? choice.message : undefined;
    const text = extractChatText(isRecord(message) ? message.content : undefined);
    const toolCalls = extractChatToolCalls(message);
    const finishReason = isRecord(choice) && typeof choice.finish_reason === 'string' ? choice.finish_reason : undefined;
    return { text: text || undefined, toolCalls: toolCalls.length > 0 ? toolCalls : undefined, finishReason };
  }

  // chat.completion.chunk
  if (isRecord(content) && content.object === 'chat.completion.chunk') {
    const choices = content.choices as unknown[] | undefined;
    const choice = Array.isArray(choices) ? choices[0] : undefined;
    const delta = isRecord(choice) ? choice.delta : undefined;
    const text = isRecord(delta) && typeof delta.content === 'string' ? delta.content : '';
    const toolCalls = isRecord(delta) && Array.isArray(delta.tool_calls)
      ? (delta.tool_calls as unknown[])
          .filter((c) => isRecord(c) && isRecord(c.function) && typeof (c.function as Record<string, unknown>).name === 'string')
          .map((c) => ({
            id: typeof (c as Record<string, unknown>).id === 'string' ? (c as Record<string, unknown>).id as string : undefined,
            name: ((c as Record<string, unknown>).function as Record<string, unknown>).name as string,
            arguments: typeof ((c as Record<string, unknown>).function as Record<string, unknown>).arguments === 'string'
              ? (((c as Record<string, unknown>).function as Record<string, unknown>).arguments as string)
              : undefined,
          }))
      : [];
    const finishReason = isRecord(choice) && typeof choice.finish_reason === 'string' ? choice.finish_reason : undefined;
    return { text: text || undefined, toolCalls: toolCalls.length > 0 ? toolCalls : undefined, finishReason };
  }

  // Responses API (object === 'response')
  if (isRecord(content) && content.object === 'response') {
    const output = Array.isArray(content.output) ? content.output as unknown[] : undefined;
    const outputText = typeof content.output_text === 'string' ? content.output_text : null;
    const text = extractResponsesOutputText(output, outputText);
    const toolCalls = extractResponsesToolCalls(output);
    const finishReason = typeof content.status === 'string' ? content.status : undefined;
    return { text: text || undefined, toolCalls: toolCalls.length > 0 ? toolCalls : undefined, finishReason };
  }

  // Responses API stream event (type starts with 'response.')
  if (isRecord(content) && typeof content.type === 'string' && content.type.startsWith('response.') && isRecord(content.response)) {
    const response = content.response as Record<string, unknown>;
    const output = Array.isArray(response.output) ? response.output as unknown[] : undefined;
    const outputText = typeof response.output_text === 'string' ? response.output_text : null;
    const text = extractResponsesOutputText(output, outputText);
    const toolCalls = extractResponsesToolCalls(output);
    const finishReason = typeof response.status === 'string' ? response.status : undefined;
    return { text: text || undefined, toolCalls: toolCalls.length > 0 ? toolCalls : undefined, finishReason };
  }

  // Plain assistant message: { role: 'assistant', content: ... }
  if (isRecord(content) && content.role === 'assistant') {
    const text = extractChatText(content.content);
    const toolCalls = extractChatToolCalls(content);
    return { text: text || undefined, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
  }

  return content;
}

function normalizeOpenAiToolCallRequest(content: unknown, metadata?: Record<string, unknown>): NormalizedContent {
  const toolCallIdHint = metadata
    ? ((metadata.tool_call_id as string | undefined) ?? (metadata.toolCallId as string | undefined))
    : undefined;
  const toolCall = extractToolCallFromContent(content, toolCallIdHint);
  if (!toolCall) return content;
  return { id: toolCall.id, name: toolCall.name, arguments: toolCall.arguments };
}

function normalizeOpenAiToolCallResponse(content: unknown): NormalizedContent {
  if (!content) return content;

  // Nested response envelope: { response: { role: 'tool', ... } }
  if (isRecord(content) && isRecord(content.response) && (content.response as Record<string, unknown>).role === 'tool') {
    const response = content.response as Record<string, unknown>;
    return {
      tool_call_id: typeof response.tool_call_id === 'string' ? response.tool_call_id : undefined,
      content: extractChatText(response.content),
    };
  }

  // Responses API function_call_output
  if (isRecord(content) && content.type === 'function_call_output') {
    return { tool_call_id: typeof content.call_id === 'string' ? content.call_id : undefined, output: content.output };
  }

  // Plain tool message: { role: 'tool', tool_call_id, content }
  if (isRecord(content) && content.role === 'tool') {
    return {
      tool_call_id: typeof content.tool_call_id === 'string' ? content.tool_call_id : undefined,
      content: typeof content.content === 'string' ? content.content : extractChatText(content.content),
    };
  }

  return content;
}

// ---------------------------------------------------------------------------
// Anthropic normalization
// ---------------------------------------------------------------------------

function extractAnthropicText(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return (content as unknown[])
      .map((part) => {
        if (!isRecord(part)) return '';
        if (part.type === 'text' && typeof part.text === 'string') return part.text;
        if (typeof part.content === 'string') return part.content;
        return '';
      })
      .filter((t) => t.length > 0)
      .join('\n');
  }
  if (isRecord(content) && Array.isArray(content.content)) {
    return extractAnthropicText(content.content);
  }
  return '';
}

function normalizeAnthropicContent(eventType: string, content: unknown): NormalizedContent {
  switch (eventType) {
    case 'user_message':
    case 'system_message':
    case 'llm_response':
    case 'agent_message': {
      const text = extractAnthropicText(content);
      return text || content;
    }
    default:
      return content;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function normalizeEventContent(
  eventType: string,
  content: unknown,
  metadata?: Record<string, unknown>
): NormalizedContent {
  // Already a plain string — already normalized or a simple event
  if (typeof content === 'string') return content;
  if (!content) return content;

  const provider = detectProvider(metadata);

  // Determine effective provider from content shape if metadata doesn't tell us
  const effectiveProvider =
    provider !== 'unknown'
      ? provider
      : looksLikeAnthropicContent(content)
      ? 'anthropic'
      : looksLikeOpenAiContent(content)
      ? 'openai'
      : 'unknown';

  if (effectiveProvider === 'anthropic') {
    return normalizeAnthropicContent(eventType, content);
  }

  if (effectiveProvider === 'openai') {
    switch (eventType) {
      case 'user_message':
        return normalizeOpenAiUserMessage(content, metadata);
      case 'system_message':
        return normalizeOpenAiSystemMessage(content);
      case 'llm_response':
      case 'agent_message':
        return normalizeOpenAiLlmResponse(content);
      case 'tool_call_request':
      case 'tool_call':
        return normalizeOpenAiToolCallRequest(content, metadata);
      case 'tool_call_response':
      case 'tool_result':
        return normalizeOpenAiToolCallResponse(content);
      default:
        return content;
    }
  }

  // Unknown provider — pass through unchanged
  return content;
}
