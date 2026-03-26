import type {
  EventHandler,
  CanvasNodeData,
  SidebarData,
  TimelineData,
  SidebarMetric,
} from "../types";
import type { TraceEvent } from "@/stores/traceDetailStore";

interface ToolResultItem {
  role?: string;
  content?: unknown;
  tool_call_id?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractResultText(content: TraceEvent["content"], metadata?: TraceEvent["metadata"]): { text: string; preview: string; isError: boolean } {
  const metadataTool = metadata && typeof metadata === "object" && "tool" in metadata
    ? (metadata.tool as string)
    : "";

  if (!content) {
    return { text: "", preview: metadataTool ? `Empty result (${metadataTool})` : "", isError: false };
  }

  if (typeof content === "string") {
    const isError = content.toLowerCase().includes("error") || content.toLowerCase().includes("failed");
    return {
      text: content,
      preview: content.length > 100 ? content.slice(0, 100) + "..." : content,
      isError,
    };
  }

  if (Array.isArray(content)) {
    const items = content as ToolResultItem[];
    const textCandidates = items
      .map((item) => item?.content)
      .filter((item) => typeof item === "string") as string[];
    const combinedText = textCandidates.join("\n\n");
    const toolCallIds = items
      .map((item) => item?.tool_call_id)
      .filter((id): id is string => typeof id === "string");
    const previewBase = `Tool results (${items.length})`;
    const preview = toolCallIds.length > 0
      ? `${previewBase} • ${toolCallIds.slice(0, 3).join(", ")}${toolCallIds.length > 3 ? "..." : ""}`
      : previewBase;
    const isError = textCandidates.some((item) => item.toLowerCase().includes("error") || item.toLowerCase().includes("failed"));
    return {
      text: combinedText || JSON.stringify(content, null, 2),
      preview,
      isError,
    };
  }

  if (isRecord(content)) {
    if ("extractedData" in content) {
      const extracted = content.extractedData;
      const keys = extracted && typeof extracted === "object" ? Object.keys(extracted as object) : [];
      const preview = keys.length > 0
        ? `Extracted: ${keys.slice(0, 3).join(", ")}${keys.length > 3 ? "..." : ""}`
        : (metadataTool ? `Empty result (${metadataTool})` : "Empty result");
      return {
        text: JSON.stringify(content, null, 2),
        preview,
        isError: false,
      };
    }

    if ("error" in content || "message" in content) {
      const errorText = (content.error as string) || (content.message as string) || "Error";
      return {
        text: errorText,
        preview: errorText.length > 100 ? errorText.slice(0, 100) + "..." : errorText,
        isError: true,
      };
    }
  }

  const text = JSON.stringify(content);
  return {
    text,
    preview: text.length > 100 ? text.slice(0, 100) + "..." : text,
    isError: false,
  };
}

export const ToolResultHandler: EventHandler = {
  eventType: "tool_call_response",

  nodeConfig: {
    nodeType: "toolResult",
    label: "Tool Result",
    highlight: false,
  },

  getCanvasData(event: TraceEvent): CanvasNodeData {
  const { text, preview, isError } = extractResultText(event.content, event.metadata);

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
      highlight: isError,
    };
  },

  getSidebarData(event: TraceEvent): SidebarData {
    const { text, isError } = extractResultText(event.content, event.metadata);
    const metadata = event.metadata as Record<string, unknown> | undefined;
    const toolName = metadata?.tool as string || "Unknown Tool";

    const metrics: SidebarMetric[] = [];

    if (event.duration) {
      metrics.push({ label: "Duration", value: `${event.duration}ms` });
    }

    const sections = [];

    if (metrics.length > 0) {
      sections.push({
        title: "Performance",
        type: "metrics" as const,
        content: metrics,
      });
    }

    if (isError) {
      sections.push({
        title: "Error Details",
        type: "text" as const,
        content: text,
        collapsible: text.length > 200,
        defaultOpen: true,
      });
    } else {
      sections.push({
        title: "Result",
        type: "json" as const,
        content: event.content as Record<string, unknown>,
        collapsible: text.length > 500,
        defaultOpen: true,
      });
    }

    sections.push({
      title: "Metadata",
      type: "json" as const,
      content: metadata || {},
      collapsible: true,
      defaultOpen: false,
    });

    return {
      title: "Tool Result",
      subtitle: `${toolName} • Step ${event.stepId}`,
      sections,
    };
  },

  getTimelineData(event: TraceEvent): TimelineData {
    const { preview, isError } = extractResultText(event.content, event.metadata);
    const metadata = event.metadata as Record<string, unknown> | undefined;
    const toolName = metadata?.tool as string || "Unknown Tool";

    return {
      title: "Tool Result",
      description: preview || `Result from ${toolName}`,
      icon: isError ? "alert-circle" : "check-circle",
      status: isError ? "error" : "completed",
      timestamp: event.timestamp,
      duration: event.duration ?? undefined,
      metadata: event.metadata ?? undefined,
    };
  },
};

export const ToolResultEventHandler: EventHandler = {
  ...ToolResultHandler,
  eventType: "tool_result",
};
