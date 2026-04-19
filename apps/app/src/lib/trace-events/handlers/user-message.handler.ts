import type { EventHandler, CanvasNodeData, SidebarData, TimelineData } from "../types";
import type { TraceEvent } from "@/stores/traceDetailStore";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractUserText(content: TraceEvent["content"]): { text: string; preview: string } {
  if (!content) {
    return { text: "", preview: "" };
  }

  if (typeof content === "string") {
    return {
      text: content,
      preview: content.length > 100 ? content.slice(0, 100) + "..." : content,
    };
  }

  if (Array.isArray(content)) {
    const textParts: string[] = [];
    for (const part of content) {
      if (!isRecord(part)) {
        continue;
      }
      const role = typeof part.role === "string" ? part.role : "";
      const contentValue = part.content;
      const textValue = typeof part.text === "string" ? part.text : "";
      if (role === "user" && typeof contentValue === "string") {
        textParts.push(contentValue);
      } else if (part.type === "text" && textValue) {
        textParts.push(textValue);
      } else if (typeof contentValue === "string") {
        textParts.push(contentValue);
      }
    }
    const text = textParts.join("\n");
    return {
      text,
      preview: text.length > 100 ? text.slice(0, 100) + "..." : text,
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

export const UserMessageHandler: EventHandler = {
  eventType: "user_message",

  nodeConfig: {
    nodeType: "userInput",
    label: "User Input",
    highlight: true,
  },

  getCanvasData(event: TraceEvent): CanvasNodeData {
    const { text, preview } = extractUserText(event.content);

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
    const { text } = extractUserText(event.content);

    return {
      title: "User Message",
      subtitle: `Step ${event.stepId} • ${new Date(event.timestamp).toLocaleTimeString()}`,
      sections: [
        {
          title: "Message Content",
          type: "text",
          content: text,
          collapsible: text.length > 500,
          defaultOpen: true,
        },
        {
          title: "Raw Content",
          type: "json",
          content: event.content as Record<string, unknown>,
          collapsible: true,
          defaultOpen: false,
        },
        {
          title: "Request Metadata",
          type: "json",
          content: (event.metadata as Record<string, unknown>) || {},
          collapsible: true,
          defaultOpen: false,
        },
      ],
    };
  },

  getTimelineData(event: TraceEvent): TimelineData {
    const { preview } = extractUserText(event.content);

    return {
      title: "User Input",
      description: preview || "User message",
      icon: "message",
      status: "completed",
      timestamp: event.timestamp,
      duration: event.duration ?? undefined,
      metadata: event.metadata ?? undefined,
    };
  },
};
