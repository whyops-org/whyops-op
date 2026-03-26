import type { TraceEvent } from "@/stores/traceDetailStore";

import type {
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionResponse,
  OpenAIChatCompletionChunk,
  OpenAIChatMessage,
  OpenAIChatAssistantMessage,
  OpenAIChatToolMessage,
  OpenAIChatContentPart,
  OpenAIResponsesRequest,
  OpenAIResponsesResponse,
  OpenAIResponsesOutputItem,
  OpenAIResponsesStreamEvent,
  OpenAIResponsesInputMessage,
} from "./openai-types";
import type { TraceEventParser } from "./types";

interface NormalizedToolCall {
  id?: string;
  name: string;
  arguments?: string;
}

interface NormalizedLlmResponseContent {
  content?: string;
  toolCalls?: NormalizedToolCall[];
  finishReason?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasProviderHint(metadata: TraceEvent["metadata"]): boolean {
  if (!metadata || !isRecord(metadata)) return false;
  const provider = metadata.provider ?? metadata.providerSlug ?? metadata.providerName;
  if (typeof provider !== "string") return false;
  const normalized = provider.toLowerCase();
  return normalized.includes("openai") || normalized.includes("openrouter");
}

function tryParseStructuredText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return text;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => (typeof entry === "string" ? entry : ""))
        .filter((entry) => entry.length > 0)
        .join("\n");
    }
    if (isRecord(parsed)) {
      if (typeof parsed.content === "string") return parsed.content;
      if (Array.isArray(parsed.parts)) {
        return parsed.parts
          .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
          .filter((entry) => entry.length > 0)
          .join("\n");
      }
    }
  } catch {
    // Ignore parse errors and fall through.
  }
  return text;
}

function extractChatText(content: string | OpenAIChatContentPart[] | undefined): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  const parts = content
    .map((part) => {
      if (part.type === "text") return part.text;
      if ((part as { type: string; text?: string }).type === "input_text") {
        return (part as { text?: string }).text ?? "";
      }
      return "";
    })
    .filter((text) => text.length > 0)
    .map((text) => tryParseStructuredText(text));
  return parts.join("\n");
}

function extractInputMessageText(messages: OpenAIResponsesInputMessage[], role: string): string {
  const matching = messages.filter((msg) => msg.role === role);
  const candidates = (matching.length > 0 ? matching : messages)
    .map((msg) => {
      if (typeof msg.content === "string") return msg.content;
      if (Array.isArray(msg.content)) {
        return msg.content
          .map((part) => (part.type === "input_text" ? part.text : ""))
          .filter((text) => text.length > 0)
          .join("\n");
      }
      return "";
    })
    .filter((text) => text.length > 0)
    .map((text) => tryParseStructuredText(text));
  return candidates.join("\n");
}

function extractResponsesOutputText(output?: OpenAIResponsesOutputItem[], outputText?: string | null): string {
  const segments: string[] = [];
  if (output) {
    output.forEach((item) => {
      if (item.type === "message") {
        item.content.forEach((part) => {
          if (part.type === "output_text") {
            segments.push(part.text);
          }
          if (part.type === "refusal") {
            segments.push(part.refusal);
          }
          if (part.type === "output_audio" && part.transcript) {
            segments.push(part.transcript);
          }
        });
      }
      if (item.type === "reasoning" && item.summary) {
        item.summary.forEach((summary) => segments.push(summary.text));
      }
    });
  }
  if (segments.length === 0 && outputText) {
    segments.push(outputText);
  }
  return segments.join("\n");
}

function extractChatToolCalls(message: OpenAIChatAssistantMessage | OpenAIChatMessage | undefined): NormalizedToolCall[] {
  if (!message || !isRecord(message)) return [];
  const toolCalls = (message as OpenAIChatAssistantMessage).tool_calls;
  if (!toolCalls || toolCalls.length === 0) return [];
  return toolCalls.map((call) => ({
    id: call.id,
    name: call.function.name,
    arguments: call.function.arguments,
  }));
}

function extractResponsesToolCalls(output?: OpenAIResponsesOutputItem[]): NormalizedToolCall[] {
  if (!output) return [];
  const calls: NormalizedToolCall[] = [];
  output.forEach((item) => {
    if (item.type === "function_call") {
      calls.push({
        id: item.call_id || item.id,
        name: item.name,
        arguments: item.arguments,
      });
      return;
    }
    if (item.type === "web_search_call") {
      calls.push({
        id: item.id,
        name: "web_search",
        arguments: item.action ? JSON.stringify(item.action) : undefined,
      });
      return;
    }
    if (item.type === "file_search_call") {
      calls.push({
        id: item.id,
        name: "file_search",
        arguments: item.queries ? JSON.stringify(item.queries) : undefined,
      });
      return;
    }
    if (item.type === "code_interpreter_call") {
      calls.push({
        id: item.id,
        name: "code_interpreter",
        arguments: item.code ?? undefined,
      });
      return;
    }
    if (item.type === "computer_call") {
      calls.push({
        id: item.id,
        name: "computer",
        arguments: item.action ? JSON.stringify(item.action) : undefined,
      });
    }
  });
  return calls;
}

function extractToolCallFromContent(content: unknown, toolCallId?: string): NormalizedToolCall | null {
  if (!content) return null;

  if (isRecord(content) && content.type === "function") {
    const name = isRecord(content.function) ? content.function.name : undefined;
    const args = isRecord(content.function) ? content.function.arguments : undefined;
    if (typeof name === "string") {
      return {
        id: typeof content.id === "string" ? content.id : toolCallId,
        name,
        arguments: typeof args === "string" ? args : undefined,
      };
    }
  }

  if (isRecord(content) && content.type === "function_call") {
    if (typeof content.name === "string") {
      return {
        id: typeof content.call_id === "string" ? content.call_id : typeof content.id === "string" ? content.id : toolCallId,
        name: content.name,
        arguments: typeof content.arguments === "string" ? content.arguments : undefined,
      };
    }
  }

  if (isRecord(content) && Array.isArray(content.tool_calls)) {
    const matches = content.tool_calls as Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
    const selected = toolCallId
      ? matches.find((call) => call.id === toolCallId)
      : matches[0];
    if (selected && selected.function?.name) {
      return {
        id: selected.id ?? toolCallId,
        name: selected.function.name,
        arguments: selected.function.arguments,
      };
    }
  }

  return null;
}

function mergeMetadata(base: TraceEvent["metadata"], patch: Record<string, unknown>): Record<string, unknown> {
  const metadataBase = base && isRecord(base) ? base : {};
  return { ...metadataBase, ...patch };
}

function parseUserEvent(event: TraceEvent): TraceEvent {
  if (!event.content) return event;

  if (isRecord(event.content) && Array.isArray(event.content.messages)) {
    const request = event.content as OpenAIChatCompletionRequest;
    const userMessages = request.messages.filter((msg) => msg.role === "user");
    const text = userMessages
      .map((msg) => extractChatText(msg.content))
      .filter((value) => value.length > 0)
      .join("\n");
    if (!text) return event;
    return {
      ...event,
      content: text,
      metadata: mergeMetadata(event.metadata, { model: request.model ?? event.metadata?.model }),
    };
  }

  if (isRecord(event.content) && "input" in event.content) {
    const request = event.content as OpenAIResponsesRequest;
    let text = "";
    if (typeof request.input === "string") {
      text = tryParseStructuredText(request.input);
    } else if (Array.isArray(request.input)) {
      text = extractInputMessageText(request.input, "user");
    }
    if (!text) return event;
    return {
      ...event,
      content: text,
      metadata: mergeMetadata(event.metadata, { model: request.model ?? event.metadata?.model }),
    };
  }

  if (Array.isArray(event.content)) {
    const messages = event.content as OpenAIChatMessage[];
    const text = messages
      .filter((msg) => msg.role === "user")
      .map((msg) => extractChatText(msg.content))
      .filter((value) => value.length > 0)
      .join("\n");
    if (!text) return event;
    return { ...event, content: text };
  }

  if (isRecord(event.content) && event.content.role === "user" && "content" in event.content) {
    const message = event.content as unknown as OpenAIChatMessage;
    const text = extractChatText(message.content);
    if (!text) return event;
    return { ...event, content: text };
  }

  return event;
}

function parseSystemEvent(event: TraceEvent): TraceEvent {
  if (!event.content) return event;

  if (isRecord(event.content) && Array.isArray(event.content.messages)) {
    const request = event.content as OpenAIChatCompletionRequest;
    const systemMessages = request.messages.filter((msg) => msg.role === "system" || msg.role === "developer");
    const text = systemMessages
      .map((msg) => extractChatText(msg.content))
      .filter((value) => value.length > 0)
      .join("\n");
    if (!text) return event;
    return { ...event, content: text };
  }

  if (isRecord(event.content) && (event.content.role === "system" || event.content.role === "developer")) {
    const message = event.content as unknown as OpenAIChatMessage;
    const text = extractChatText(message.content);
    if (!text) return event;
    return { ...event, content: text };
  }

  return event;
}

function parseLlmResponseEvent(event: TraceEvent): TraceEvent {
  if (!event.content) return event;

  if (isRecord(event.content) && event.content.object === "chat.completion") {
    const response = event.content as OpenAIChatCompletionResponse;
    const choice = response.choices?.[0];
    const message = choice?.message;
    const text = message ? extractChatText(message.content) : "";
    const toolCalls = extractChatToolCalls(message);
    const content: NormalizedLlmResponseContent = {
      content: text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: choice?.finish_reason ?? undefined,
    };
    const usage = response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined;

    return {
      ...event,
      content,
      metadata: mergeMetadata(event.metadata, {
        model: response.model ?? event.metadata?.model,
        usage: usage ?? event.metadata?.usage,
      }),
    };
  }

  if (isRecord(event.content) && event.content.object === "chat.completion.chunk") {
    const response = event.content as OpenAIChatCompletionChunk;
    const choice = response.choices?.[0];
    const delta = choice?.delta;
    const text = typeof delta?.content === "string" ? delta.content : "";
    const toolCalls = delta?.tool_calls
      ?.map((call) => ({
        id: call.id,
        name: call.function?.name ?? "tool",
        arguments: call.function?.arguments,
      }))
      .filter((call) => call.name.length > 0);

    const content: NormalizedLlmResponseContent = {
      content: text,
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: choice?.finish_reason ?? undefined,
    };
    return {
      ...event,
      content,
      metadata: mergeMetadata(event.metadata, {
        model: response.model ?? event.metadata?.model,
      }),
    };
  }

  if (isRecord(event.content) && event.content.object === "response") {
    const response = event.content as OpenAIResponsesResponse;
    const text = extractResponsesOutputText(response.output, response.output_text ?? null);
    const toolCalls = extractResponsesToolCalls(response.output);
    const content: NormalizedLlmResponseContent = {
      content: text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: response.status ?? undefined,
    };
    const usage = response.usage
      ? {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined;

    return {
      ...event,
      content,
      metadata: mergeMetadata(event.metadata, {
        model: response.model ?? event.metadata?.model,
        usage: usage ?? event.metadata?.usage,
      }),
    };
  }

  if (isRecord(event.content) && event.content.role === "assistant") {
    const message = event.content as unknown as OpenAIChatAssistantMessage;
    const text = extractChatText(message.content);
    const toolCalls = extractChatToolCalls(message);
    const content: NormalizedLlmResponseContent = {
      content: text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
    return {
      ...event,
      content,
    };
  }

  if (isRecord(event.content) && event.content.type && String(event.content.type).startsWith("response.")) {
    const streamEvent = event.content as OpenAIResponsesStreamEvent;
    if ("response" in streamEvent && streamEvent.response) {
      const response = streamEvent.response;
      const text = extractResponsesOutputText(response.output, response.output_text ?? null);
      const toolCalls = extractResponsesToolCalls(response.output);
      const content: NormalizedLlmResponseContent = {
        content: text,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: response.status ?? undefined,
      };
      const usage = response.usage
        ? {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined;

      return {
        ...event,
        content,
        metadata: mergeMetadata(event.metadata, {
          model: response.model ?? event.metadata?.model,
          usage: usage ?? event.metadata?.usage,
        }),
      };
    }
  }

  if (isRecord(event.content) && "choices" in event.content) {
    const response = event.content as OpenAIChatCompletionResponse;
    const choice = response.choices?.[0];
    const message = choice?.message;
    const text = message ? extractChatText(message.content) : "";
    if (!text && (!message || !message.tool_calls)) {
      return event;
    }
    const toolCalls = extractChatToolCalls(message);
    const content: NormalizedLlmResponseContent = {
      content: text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: choice?.finish_reason ?? undefined,
    };

    return {
      ...event,
      content,
      metadata: mergeMetadata(event.metadata, {
        model: response.model ?? event.metadata?.model,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : event.metadata?.usage,
      }),
    };
  }

  return event;
}

function parseToolCallRequest(event: TraceEvent): TraceEvent {
  const toolCallIdHint = isRecord(event.metadata)
    ? (event.metadata.tool_call_id as string | undefined) ?? (event.metadata.toolCallId as string | undefined)
    : undefined;
  const toolCall = extractToolCallFromContent(event.content, toolCallIdHint);
  if (!toolCall) return event;

  return {
    ...event,
    content: {
      id: toolCall.id,
      name: toolCall.name,
      arguments: toolCall.arguments,
    },
    metadata: mergeMetadata(event.metadata, {
      tool: toolCall.name,
      tool_call_id: toolCall.id ?? toolCallIdHint,
    }),
  };
}

function parseToolCallResponse(event: TraceEvent): TraceEvent {
  if (!event.content) return event;

  if (isRecord(event.content) && event.content.type === "function_call_output") {
    const outputItem = event.content as Extract<OpenAIResponsesOutputItem, { type: "function_call_output" }>;
    return {
      ...event,
      content: {
        tool_call_id: outputItem.call_id,
        output: outputItem.output,
      },
      metadata: mergeMetadata(event.metadata, { tool_call_id: outputItem.call_id }),
    };
  }

  if (isRecord(event.content) && event.content.role === "tool") {
    const message = event.content as unknown as OpenAIChatToolMessage;
    return {
      ...event,
      content: {
        tool_call_id: message.tool_call_id,
        content: typeof message.content === "string" ? message.content : extractChatText(message.content),
      },
      metadata: mergeMetadata(event.metadata, { tool_call_id: message.tool_call_id }),
    };
  }

  return event;
}

export const openAiTraceEventParser: TraceEventParser = {
  id: "openai",
  canParse: (event) => {
    if (hasProviderHint(event.metadata)) return true;
    if (!event.content) return false;
    if (isRecord(event.content) && (event.content.object === "chat.completion" || event.content.object === "response")) {
      return true;
    }
    if (isRecord(event.content) && "messages" in event.content && "model" in event.content) {
      return true;
    }
    if (isRecord(event.content) && "input" in event.content && "model" in event.content) {
      return true;
    }
    if (isRecord(event.content) && "role" in event.content && "content" in event.content) {
      return true;
    }
    if (Array.isArray(event.content)) {
      const first = event.content[0];
      return isRecord(first) && "role" in first && "content" in first;
    }
    return false;
  },
  parse: (event) => {
    switch (event.eventType) {
      case "user_message":
        return parseUserEvent(event);
      case "system_message":
        return parseSystemEvent(event);
      case "llm_response":
      case "agent_message":
        return parseLlmResponseEvent(event);
      case "tool_call":
      case "tool_call_request":
        return parseToolCallRequest(event);
      case "tool_call_response":
      case "tool_result":
        return parseToolCallResponse(event);
      default:
        return event;
    }
  },
};
