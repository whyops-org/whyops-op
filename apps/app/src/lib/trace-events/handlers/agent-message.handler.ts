import type { EventHandler, CanvasNodeData, SidebarData, TimelineData, SidebarMetric } from "../types";
import type { TraceEvent } from "@/stores/traceDetailStore";

function extractAgentText(content: TraceEvent["content"]): { text: string; preview: string } {
  if (!content) {
    return { text: "", preview: "" };
  }

  if (typeof content === "string") {
    return {
      text: content,
      preview: content.length > 100 ? content.slice(0, 100) + "..." : content,
    };
  }

  if (typeof content === "object" && content !== null) {
    if ("content" in content && typeof content.content === "string") {
      return {
        text: content.content,
        preview: content.content.length > 100 ? content.content.slice(0, 100) + "..." : content.content,
      };
    }
  }

  const text = JSON.stringify(content);
  return { text, preview: text.length > 100 ? text.slice(0, 100) + "..." : text };
}

export const AgentMessageHandler: EventHandler = {
  eventType: "agent_message",

  nodeConfig: {
    nodeType: "llmResponse",
    label: "Agent Message",
    highlight: true,
  },

  getCanvasData(event: TraceEvent): CanvasNodeData {
    const { text, preview } = extractAgentText(event.content);

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
      contentPreview: preview,
      truncated: text.length > 200,
      nodeType: this.nodeConfig.nodeType,
      highlight: this.nodeConfig.highlight ?? false,
    };
  },

  getSidebarData(event: TraceEvent): SidebarData {
    const { text } = extractAgentText(event.content);

    const metrics: SidebarMetric[] = [];

    if (event.duration) {
      metrics.push({ label: "Duration", value: `${event.duration}ms` });
    }

    if (event.metadata?.latencyMs) {
      metrics.push({ label: "Latency", value: `${event.metadata.latencyMs}ms` });
    }

    const sections = [];

    if (metrics.length > 0) {
      sections.push({
        title: "Performance",
        type: "metrics" as const,
        content: metrics,
      });
    }

    sections.push({
      title: "Message Content",
      type: "text" as const,
      content: text,
      collapsible: text.length > 500,
      defaultOpen: true,
    });

    sections.push({
      title: "Raw Content",
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
      title: "Agent Message",
      subtitle: `Step ${event.stepId} • ${new Date(event.timestamp).toLocaleTimeString()}`,
      sections,
    };
  },

  getTimelineData(event: TraceEvent): TimelineData {
    const { preview } = extractAgentText(event.content);

    return {
      title: "Agent Message",
      description: preview || "Agent response",
      icon: "bot",
      status: event.isLateEvent ? "error" : "completed",
      timestamp: event.timestamp,
      duration: event.duration ?? undefined,
      metadata: event.metadata ?? undefined,
    };
  },
};
