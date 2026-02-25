import type { EventHandler, CanvasNodeData, SidebarData, TimelineData } from "../types";
import type { TraceEvent } from "@/stores/traceDetailStore";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractErrorText(content: TraceEvent["content"]): { text: string; preview: string } {
  if (!content) {
    return { text: "Unknown error", preview: "Unknown error" };
  }

  if (typeof content === "string") {
    return {
      text: content,
      preview: content.length > 100 ? content.slice(0, 100) + "..." : content,
    };
  }

  if (isRecord(content)) {
    const errorText = (content.error as string) || (content.message as string) || (content.errorMessage as string);

    if (errorText) {
      return {
        text: errorText,
        preview: errorText.length > 100 ? errorText.slice(0, 100) + "..." : errorText,
      };
    }
  }

  const text = JSON.stringify(content);
  return {
    text,
    preview: text.length > 100 ? text.slice(0, 100) + "..." : text,
  };
}

export const ErrorMessageHandler: EventHandler = {
  eventType: "error",

  nodeConfig: {
    nodeType: "error",
    label: "Error",
    highlight: true,
  },

  getCanvasData(event: TraceEvent): CanvasNodeData {
    const { text, preview } = extractErrorText(event.content);

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
      highlight: true,
    };
  },

  getSidebarData(event: TraceEvent): SidebarData {
    const { text } = extractErrorText(event.content);

    return {
      title: "Error",
      subtitle: `Step ${event.stepId} • ${new Date(event.timestamp).toLocaleTimeString()}`,
      sections: [
        {
          title: "Error Message",
          type: "text",
          content: text,
          defaultOpen: true,
        },
        {
          title: "Error Details",
          type: "json",
          content: event.content as Record<string, unknown>,
          collapsible: true,
          defaultOpen: false,
        },
        {
          title: "Context Metadata",
          type: "json",
          content: (event.metadata as Record<string, unknown>) || {},
          collapsible: true,
          defaultOpen: false,
        },
      ],
    };
  },

  getTimelineData(event: TraceEvent): TimelineData {
    const { preview } = extractErrorText(event.content);

    return {
      title: "Error",
      description: preview,
      icon: "alert-triangle",
      status: "error",
      timestamp: event.timestamp,
      duration: event.duration ?? undefined,
      metadata: event.metadata ?? undefined,
    };
  },
};
