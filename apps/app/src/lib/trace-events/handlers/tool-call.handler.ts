import type { EventHandler, CanvasNodeData, SidebarData, TimelineData } from "../types";
import type { TraceEvent } from "@/stores/traceDetailStore";

interface ToolCallContent {
  name?: string;
  arguments?: string | Record<string, unknown>;
  id?: string;
}

function extractToolInfo(
  content: TraceEvent["content"],
  metadata?: TraceEvent["metadata"]
): { name: string; args: string; argsPreview: string } {
  const metadataTool = metadata && typeof metadata === "object" && "tool" in metadata
    ? (metadata.tool as string)
    : "";

  if (!content) {
    return { name: metadataTool || "Unknown Tool", args: "", argsPreview: "" };
  }

  if (typeof content === "string") {
    const argsPreview = content.length > 100 ? content.slice(0, 100) + "..." : content;
    return { name: metadataTool || "Unknown Tool", args: content, argsPreview };
  }

  const typedContent = content as ToolCallContent;
  const name = typedContent.name || metadataTool || "Unknown Tool";

  let args = "";
  if (typedContent.arguments) {
    if (typeof typedContent.arguments === "string") {
      args = typedContent.arguments;
    } else {
      try {
        args = JSON.stringify(typedContent.arguments, null, 2);
      } catch {
        args = String(typedContent.arguments);
      }
    }
  } else {
    try {
      args = JSON.stringify(content, null, 2);
    } catch {
      args = String(content);
    }
  }

  const argsPreview = args.length > 100 ? args.slice(0, 100) + "..." : args;

  return { name, args, argsPreview };
}

export const ToolCallHandler: EventHandler = {
  eventType: "tool_call_request",

  nodeConfig: {
    nodeType: "toolCall",
    label: "Tool Call",
    highlight: true,
  },

  getCanvasData(event: TraceEvent): CanvasNodeData {
    const { name, argsPreview } = extractToolInfo(event.content, event.metadata);
    const contentText = `${name}(${argsPreview})`;

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
      contentPreview: name,
      truncated: false,
      nodeType: this.nodeConfig.nodeType,
      highlight: this.nodeConfig.highlight ?? false,
    };
  },

  getSidebarData(event: TraceEvent): SidebarData {
    const { name, args } = extractToolInfo(event.content, event.metadata);
    let parsedArgs: Record<string, unknown> = {};

    try {
      if (typeof event.content === "object" && event.content !== null && "arguments" in event.content) {
        parsedArgs = (event.content.arguments as Record<string, unknown>) || {};
      } else if (typeof event.content === "string") {
        parsedArgs = args ? { raw: args } : {};
      } else if (event.content) {
        parsedArgs = event.content as Record<string, unknown>;
      }
    } catch {
      parsedArgs = { raw: args };
    }

    return {
      title: "Tool Call",
      subtitle: `${name} • Step ${event.stepId}`,
      sections: [
        {
          title: "Tool Name",
          type: "text",
          content: name,
        },
        {
          title: "Arguments",
          type: "json",
          content: parsedArgs,
          collapsible: Object.keys(parsedArgs).length > 5,
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
          title: "Metadata",
          type: "json",
          content: (event.metadata as Record<string, unknown>) || {},
          collapsible: true,
          defaultOpen: false,
        },
      ],
    };
  },

  getTimelineData(event: TraceEvent): TimelineData {
    const { name } = extractToolInfo(event.content, event.metadata);

    return {
      title: "Tool Call",
      description: name,
      icon: "wrench",
      status: "running",
      timestamp: event.timestamp,
      duration: event.duration ?? undefined,
      metadata: event.metadata ?? undefined,
    };
  },
};
