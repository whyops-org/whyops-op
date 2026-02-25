import type { TraceEvent } from "@/stores/traceDetailStore";
import type { TraceEventParser } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasAnthropicProvider(metadata: TraceEvent["metadata"]): boolean {
  if (!metadata || !isRecord(metadata)) return false;
  const provider = metadata.provider ?? metadata.providerSlug ?? metadata.providerName;
  if (typeof provider !== "string") return false;
  return provider.toLowerCase().includes("anthropic");
}

function extractAnthropicText(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!isRecord(part)) return "";
        if (part.type === "text" && typeof part.text === "string") return part.text;
        if (typeof part.content === "string") return part.content;
        return "";
      })
      .filter((text) => text.length > 0)
      .join("\n");
  }
  if (isRecord(content) && Array.isArray(content.content)) {
    return extractAnthropicText(content.content);
  }
  return "";
}

function mergeMetadata(base: TraceEvent["metadata"], patch: Record<string, unknown>): Record<string, unknown> {
  const metadataBase = base && isRecord(base) ? base : {};
  return { ...metadataBase, ...patch };
}

export const anthropicTraceEventParser: TraceEventParser = {
  id: "anthropic",
  canParse: (event) => {
    if (hasAnthropicProvider(event.metadata)) return true;
    if (!event.content) return false;
    if (isRecord(event.content) && event.content.type === "message") return true;
    return false;
  },
  parse: (event) => {
    switch (event.eventType) {
      case "user_message":
      case "system_message":
      case "agent_message":
      case "llm_response": {
        const text = extractAnthropicText(event.content);
        if (!text) return event;
        const model = isRecord(event.content) && typeof event.content.model === "string" ? event.content.model : undefined;
        return {
          ...event,
          content: text,
          metadata: mergeMetadata(event.metadata, model ? { model } : {}),
        };
      }
      default:
        return event;
    }
  },
};
