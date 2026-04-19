import type { EventHandler, CanvasNodeData, SidebarData, TimelineData } from "../types";
import type { TraceEvent } from "@/stores/traceDetailStore";

interface LlmThinkingContent {
  type?: string;
  thinking?: string;
  signature?: string;
}

function extractThinkingText(content: TraceEvent["content"]): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  const typed = content as LlmThinkingContent;
  return typed.thinking || "";
}

export const LlmThinkingHandler: EventHandler = {
  eventType: "llm_thinking",

  nodeConfig: {
    nodeType: "llmThinking",
    label: "LLM Thinking",
    highlight: false,
  },

  getCanvasData(event: TraceEvent): CanvasNodeData {
    const text = extractThinkingText(event.content);

    return {
      label: this.nodeConfig.label,
      eventType: event.eventType,
      content: event.content,
      metadata: event.metadata,
      stepId: event.stepId,
      parentStepId: event.parentStepId ?? null,
      spanId: event.spanId ?? null,
      timestamp: event.timestamp,
      duration: event.duration ?? null,
      timeSinceStart: event.timeSinceStart ?? 0,
      isLateEvent: event.isLateEvent ?? false,
      contentText: text,
      contentPreview: text.length > 100 ? text.slice(0, 100) + "..." : text,
      truncated: text.length > 200,
      nodeType: this.nodeConfig.nodeType,
      highlight: false,
    };
  },

  getSidebarData(event: TraceEvent): SidebarData {
    const text = extractThinkingText(event.content);
    const usage = event.metadata?.usage as { totalTokens?: number; input?: number; output?: number } | undefined;

    const sections = [];

    if (text) {
      sections.push({
        title: "Thinking Content",
        type: "text" as const,
        content: text,
        defaultOpen: true,
      });
    }

    if (usage) {
      sections.push({
        title: "Token Usage",
        type: "metrics" as const,
        content: [
          ...(usage.totalTokens ? [{ label: "Total Tokens", value: usage.totalTokens.toLocaleString() }] : []),
          ...(usage.input ? [{ label: "Input Tokens", value: usage.input.toLocaleString() }] : []),
          ...(usage.output ? [{ label: "Output Tokens", value: usage.output.toLocaleString() }] : []),
        ],
        defaultOpen: true,
      });
    }

    sections.push({
      title: "Raw Payload",
      type: "json" as const,
      content: event.content as Record<string, unknown>,
      collapsible: true,
      defaultOpen: false,
    });

    return {
      title: "LLM Thinking",
      subtitle: `${event.metadata?.model || "Unknown Model"} • Step ${event.stepId}`,
      sections,
    };
  },

  getTimelineData(event: TraceEvent): TimelineData {
    const text = extractThinkingText(event.content);

    return {
      title: "LLM Thinking",
      description: text.slice(0, 60) + (text.length > 60 ? "..." : ""),
      icon: "brain",
      status: "completed",
      timestamp: event.timestamp,
      duration: event.duration,
      metadata: {
        model: event.metadata?.model,
      },
    };
  },
};
