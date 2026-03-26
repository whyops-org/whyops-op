import type { EventHandler, CanvasNodeData, SidebarData, TimelineData, SidebarMetric } from "../types";
import type { TraceEvent } from "@/stores/traceDetailStore";

interface LlmResponseContent {
  content?: string;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
  finishReason?: string;
}

const TOOL_CALL_MARKER = "tool_calls";

function extractResponseText(content: TraceEvent["content"]): { text: string; preview: string; toolCalls: string } {
  if (!content) {
    return { text: "", preview: "", toolCalls: "" };
  }

  if (typeof content === "string") {
    return {
      text: content,
      preview: content.length > 100 ? content.slice(0, 100) + "..." : content,
      toolCalls: "",
    };
  }

  const typedContent = content as LlmResponseContent;
  let text = typedContent.content || "";
  let toolCallsText = "";

  if (typedContent.toolCalls && typedContent.toolCalls.length > 0) {
    const callNames = typedContent.toolCalls.map((tc) => tc.name || tc.id).join(", ");
    toolCallsText = `Tool Calls: ${callNames}`;
    if (!text) {
      text = toolCallsText;
    }
  }

  return {
    text,
    preview: text.length > 100 ? text.slice(0, 100) + "..." : text,
    toolCalls: toolCallsText,
  };
}

export const LlmResponseHandler: EventHandler = {
  eventType: "llm_response",

  nodeConfig: {
    nodeType: "llmResponse",
    label: "LLM Response",
    highlight: true,
  },

  getCanvasData(event: TraceEvent): CanvasNodeData {
    const { text, preview, toolCalls } = extractResponseText(event.content);
    const contentText = toolCalls ? `${text}\n${toolCalls}` : text;

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
      contentText,
      contentPreview: preview,
      truncated: text.length > 200,
      nodeType: this.nodeConfig.nodeType,
      highlight: this.nodeConfig.highlight ?? false,
    };
  },

  getSidebarData(event: TraceEvent): SidebarData {
    const typedContent = event.content as LlmResponseContent;
    const { text } = extractResponseText(event.content);
    const usage = event.metadata?.usage as { totalTokens?: number; promptTokens?: number; completionTokens?: number } | undefined;

    const metrics: SidebarMetric[] = [];

    if (usage) {
      if (usage.totalTokens) {
        metrics.push({ label: "Total Tokens", value: usage.totalTokens.toLocaleString() });
      }
      if (usage.promptTokens) {
        metrics.push({ label: "Prompt Tokens", value: usage.promptTokens.toLocaleString() });
      }
      if (usage.completionTokens) {
        metrics.push({ label: "Completion Tokens", value: usage.completionTokens.toLocaleString() });
      }
    }

    if (event.metadata?.latencyMs) {
      metrics.push({ label: "Latency", value: `${event.metadata.latencyMs}ms` });
    }

    const sections = [];

    if (metrics.length > 0) {
      sections.push({
        title: "Token Usage & Performance",
        type: "metrics" as const,
        content: metrics,
        defaultOpen: true,
      });
    }

    if (typedContent?.finishReason) {
      sections.push({
        title: "Finish Reason",
        type: "text" as const,
        content: typedContent.finishReason,
      });
    }

    if (text) {
      sections.push({
        title: "Response Content",
        type: "text" as const,
        content: text,
        collapsible: text.length > 500,
        defaultOpen: true,
      });
    }

    if (typedContent?.toolCalls && typedContent.toolCalls.length > 0) {
      sections.push({
        title: "Tool Calls",
        type: "table" as const,
        content: typedContent.toolCalls.map((tc) => ({
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments?.slice(0, 100) + (tc.arguments?.length > 100 ? "..." : ""),
        })),
        defaultOpen: true,
      });
    }

    sections.push({
      title: "Raw Response",
      type: "json" as const,
      content: event.content as Record<string, unknown>,
      collapsible: true,
      defaultOpen: false,
    });

    sections.push({
      title: "Metadata",
      type: "json" as const,
      content: (event.metadata as Record<string, unknown>) || {},
      collapsible: true,
      defaultOpen: false,
    });

    return {
      title: "LLM Response",
      subtitle: `${event.metadata?.model || "Unknown Model"} • Step ${event.stepId}`,
      sections,
    };
  },

  getTimelineData(event: TraceEvent): TimelineData {
    const typedContent = event.content as LlmResponseContent;
    const usage = event.metadata?.usage as { totalTokens?: number } | undefined;
    const tokens = usage?.totalTokens;

    let description = "";
    if (typedContent?.finishReason === TOOL_CALL_MARKER) {
      description = `Tool calls (${typedContent.toolCalls?.length || 0})`;
    } else if (typedContent?.content) {
      description = typedContent.content.slice(0, 60) + (typedContent.content.length > 60 ? "..." : "");
    }

    return {
      title: "LLM Response",
      description,
      icon: "sparkles",
      status: event.isLateEvent ? "error" : "completed",
      timestamp: event.timestamp,
      duration: event.metadata?.latencyMs,
      metadata: {
        model: event.metadata?.model,
        tokens,
        finishReason: typedContent?.finishReason,
      },
    };
  },
};
