import type { Node, Edge, MarkerType } from "reactflow";

import type { TraceEvent } from "@/stores/traceDetailStore";
import { parseTraceEvents, type TraceEventParserInput } from "@/lib/trace-event-parsers";
import { eventHandlerRegistry, type CanvasNodeData, type SidebarData, type TimelineData, type TraceNodeDataBase } from "./trace-events";

export type { CanvasNodeData, SidebarData, TimelineData };

export interface TraceNodeData extends TraceNodeDataBase {
  contentText?: string;
  contentPreview?: string;
  truncated?: boolean;
  nodeType?: string;
  highlight?: boolean;
}

export interface ConvertTraceOptions {
  nodeSpacing?: number;
  startX?: number;
  startY?: number;
  edgeOptions?: Partial<Pick<Edge, "type" | "style" | "markerEnd">>;
  nodeWidth?: number;
  parser?: TraceEventParserInput;
}

const DEFAULT_OPTIONS: Required<Omit<ConvertTraceOptions, "parser">> = {
  nodeSpacing: 150,
  startX: 250,
  startY: 50,
  edgeOptions: {
    type: "smoothstep",
    style: {
      strokeWidth: 2,
      stroke: "var(--muted-foreground)",
    },
    markerEnd: {
      type: "arrowclosed" as MarkerType.ArrowClosed,
      color: "var(--muted-foreground)",
    },
  },
  nodeWidth: 200,
};

export function convertEventsToNodesAndEdges(
  events: TraceEvent[],
  options: ConvertTraceOptions = {}
): { nodes: Node<TraceNodeData>[]; edges: Edge[] } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const normalizedEvents = options.parser ? parseTraceEvents(events, options.parser) : events;
  const nodes: Node<TraceNodeData>[] = [];
  const edges: Edge[] = [];

  if (!normalizedEvents || normalizedEvents.length === 0) {
    return { nodes, edges };
  }

  const sortedEvents = [...normalizedEvents].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const eventsByStepId = new Map<number, TraceEvent>();
  sortedEvents.forEach((event) => {
    eventsByStepId.set(event.stepId, event);
  });

  const displayedEvents = sortedEvents.filter((event) => eventHandlerRegistry.shouldDisplay(event));
  const displayedIndexById = new Map<string, number>();
  displayedEvents.forEach((event, index) => {
    displayedIndexById.set(event.id, index);
  });
  let lastVisibleEventId: string | null = null;
  let lastNonToolEventId: string | null = null;
  let lastLlmResponseId: string | null = null;
  const pendingToolCallsByName = new Map<string, string[]>();
  const toolCallRequestById = new Map<string, string>();
  const toolCallResponseById = new Map<string, string>();
  const toolCallRequestsByParent = new Map<number, string[]>();
  const toolCallResponsesByParent = new Map<number, string[]>();

  const getToolName = (event: TraceEvent): string | null => {
    if (event.metadata && typeof event.metadata === "object" && "tool" in event.metadata) {
      return event.metadata.tool as string;
    }
    if (event.content && typeof event.content === "object" && "name" in event.content) {
      return event.content.name as string;
    }
    return null;
  };

  const getToolCallId = (event: TraceEvent): string | null => {
    if (event.content && typeof event.content === "object") {
      if ("id" in event.content && typeof event.content.id === "string") {
        return event.content.id;
      }
      if ("tool_call_id" in event.content && typeof event.content.tool_call_id === "string") {
        return event.content.tool_call_id;
      }
    }
    if (event.metadata && typeof event.metadata === "object") {
      if ("tool_call_id" in event.metadata && typeof event.metadata.tool_call_id === "string") {
        return event.metadata.tool_call_id;
      }
      if ("toolCallId" in event.metadata && typeof event.metadata.toolCallId === "string") {
        return event.metadata.toolCallId;
      }
    }
    return null;
  };

  const getToolCallIdsFromContent = (event: TraceEvent): string[] => {
    if (Array.isArray(event.content)) {
      return event.content
        .map((item) =>
          item && typeof item === "object" && "tool_call_id" in item
            ? (item.tool_call_id as string)
            : null
        )
        .filter((id): id is string => typeof id === "string");
    }
    const single = getToolCallId(event);
    return single ? [single] : [];
  };

  const getToolNamesFromToolResultContent = (event: TraceEvent): string[] => {
    const toolNames = new Set<string>();
    const visited = new Set<unknown>();
    const MAX_DEPTH = 6;
    const MAX_STRING_LENGTH = 120;
    const MAX_ITEMS = 4000;
    let scannedItems = 0;

    const addCandidate = (value: string) => {
      if (!value) return;
      if (value.length > MAX_STRING_LENGTH) return;
      if (/\s/.test(value)) return;
      toolNames.add(value);
    };

    const scanValue = (value: unknown, depth: number) => {
      if (scannedItems > MAX_ITEMS) return;
      if (depth > MAX_DEPTH) return;
      if (value === null || value === undefined) return;

      if (typeof value === "string") {
        scannedItems += 1;
        const trimmed = value.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          try {
            const parsed = JSON.parse(trimmed);
            scanValue(parsed, depth + 1);
          } catch {
            addCandidate(trimmed);
          }
        } else {
          addCandidate(trimmed);
        }
        return;
      }

      if (typeof value !== "object") {
        return;
      }

      if (visited.has(value)) return;
      visited.add(value);

      if (Array.isArray(value)) {
        value.forEach((item) => scanValue(item, depth + 1));
        return;
      }

      Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
        scannedItems += 1;
        addCandidate(key);
        scanValue(entry, depth + 1);
      });
    };

    scanValue(event.content, 0);

    if (toolNames.size === 0) {
      const fallbackName = getToolName(event);
      if (fallbackName) {
        toolNames.add(fallbackName);
      }
    }

    return Array.from(toolNames);
  };

  displayedEvents.forEach((event) => {
    if (event.eventType === "tool_call_request") {
      const toolCallId = getToolCallId(event);
      if (toolCallId) {
        toolCallRequestById.set(toolCallId, event.id);
      }
      if (event.parentStepId) {
        const bucket = toolCallRequestsByParent.get(event.parentStepId) ?? [];
        bucket.push(event.id);
        toolCallRequestsByParent.set(event.parentStepId, bucket);
      }
    }
    if (event.eventType === "tool_call_response") {
      const toolCallId = getToolCallId(event);
      if (toolCallId) {
        toolCallResponseById.set(toolCallId, event.id);
      }
      if (event.parentStepId) {
        const bucket = toolCallResponsesByParent.get(event.parentStepId) ?? [];
        bucket.push(event.id);
        toolCallResponsesByParent.set(event.parentStepId, bucket);
      }
    }
  });

  displayedEvents.forEach((event, index) => {
    const canvasData = eventHandlerRegistry.getCanvasData(event);
    const yPosition = opts.startY + index * opts.nodeSpacing;

    const nodeData: TraceNodeData = {
      ...canvasData,
    };

    const node: Node<TraceNodeData> = {
      id: event.id,
      type: canvasData.nodeType,
      position: { x: opts.startX, y: yPosition },
      data: nodeData,
    };

    nodes.push(node);

    let sourceIds: string[] = [];

    if (event.eventType === "tool_call_request") {
      const toolName = getToolName(event);
      if (toolName) {
        const pending = pendingToolCallsByName.get(toolName) ?? [];
        pending.push(event.id);
        pendingToolCallsByName.set(toolName, pending);
      }
      sourceIds = [lastLlmResponseId || lastNonToolEventId || lastVisibleEventId].filter(
        (value): value is string => Boolean(value)
      );
    } else if (event.eventType === "tool_call_response") {
      const toolName = getToolName(event);
      if (toolName) {
        const pending = pendingToolCallsByName.get(toolName);
        if (pending && pending.length > 0) {
          const candidate = pending.shift() ?? null;
          if (candidate && (displayedIndexById.get(candidate) ?? -1) < index) {
            sourceIds = [candidate];
          }
        }
      }
      if (sourceIds.length === 0 && lastVisibleEventId) {
        sourceIds = [lastVisibleEventId];
      }
    } else if (event.eventType === "tool_result") {
      const toolCallIds = getToolCallIdsFromContent(event);
      const toolNames = getToolNamesFromToolResultContent(event);
      const matchedSourceIds = new Set<string>();
      toolCallIds.forEach((toolCallId) => {
        const responseId = toolCallResponseById.get(toolCallId);
        if (responseId) {
          matchedSourceIds.add(responseId);
          return;
        }
        const requestId = toolCallRequestById.get(toolCallId);
        if (requestId) {
          matchedSourceIds.add(requestId);
        }
      });
      if (matchedSourceIds.size > 0) {
        sourceIds = Array.from(matchedSourceIds);
      } else {
        if (toolNames.length > 0) {
          const responseMatches: string[] = [];
          const requestMatches: string[] = [];
          for (let i = index - 1; i >= 0; i -= 1) {
            const previousEvent = displayedEvents[i];
            if (previousEvent.eventType === "tool_result") {
              break;
            }
            if (
              previousEvent.eventType !== "tool_call_response" &&
              previousEvent.eventType !== "tool_call_request"
            ) {
              continue;
            }
            const previousToolName = getToolName(previousEvent);
            if (!previousToolName || !toolNames.includes(previousToolName)) {
              continue;
            }
            if (previousEvent.eventType === "tool_call_response") {
              responseMatches.push(previousEvent.id);
            } else {
              requestMatches.push(previousEvent.id);
            }
          }

          if (responseMatches.length > 0) {
            sourceIds = responseMatches.reverse();
          } else if (requestMatches.length > 0) {
            sourceIds = requestMatches.reverse();
          }
        }

        if (event.parentStepId) {
          const responseIds = toolCallResponsesByParent.get(event.parentStepId) ?? [];
          if (sourceIds.length === 0 && responseIds.length > 0) {
            sourceIds = responseIds;
          } else {
            const requestIds = toolCallRequestsByParent.get(event.parentStepId) ?? [];
            if (sourceIds.length === 0 && requestIds.length > 0) {
              sourceIds = requestIds;
            }
          }
        }

        if (sourceIds.length === 0) {
          let parentEvent: TraceEvent | undefined;
          if (event.parentStepId && eventsByStepId.has(event.parentStepId)) {
            parentEvent = eventsByStepId.get(event.parentStepId);
          }
          if (parentEvent && parentEvent.id !== event.id) {
            const parentIndex = displayedIndexById.get(parentEvent.id) ?? -1;
            if (parentIndex > -1 && parentIndex < index) {
              sourceIds = [parentEvent.id];
            } else if (lastVisibleEventId) {
              sourceIds = [lastVisibleEventId];
            }
          } else if (lastVisibleEventId) {
            sourceIds = [lastVisibleEventId];
          }
        }
      }
    } else {
      let parentEvent: TraceEvent | undefined;
      if (event.parentStepId && eventsByStepId.has(event.parentStepId)) {
        parentEvent = eventsByStepId.get(event.parentStepId);
      }
      if (parentEvent && parentEvent.id !== event.id) {
        const parentIndex = displayedIndexById.get(parentEvent.id) ?? -1;
        if (parentIndex > -1 && parentIndex < index) {
          sourceIds = [parentEvent.id];
        } else if (lastVisibleEventId) {
          sourceIds = [lastVisibleEventId];
        }
      } else if (lastVisibleEventId) {
        sourceIds = [lastVisibleEventId];
      }
    }

    const dedupedSourceIds = Array.from(new Set(sourceIds));
    const validSourceIds = dedupedSourceIds.filter((sourceId) => {
      const sourceIndex = displayedIndexById.get(sourceId) ?? -1;
      return sourceIndex > -1 && sourceIndex < index;
    });

    if (validSourceIds.length > 0) {
      validSourceIds.forEach((sourceId) => {
        edges.push({
          id: `e-${sourceId}-${event.id}`,
          source: sourceId,
          target: event.id,
          type: opts.edgeOptions.type,
          style: opts.edgeOptions.style,
          markerEnd: opts.edgeOptions.markerEnd,
        });
      });
    } else {
      nodes.unshift({
        id: "start",
        type: "start",
        position: { x: opts.startX, y: 0 },
        data: {
          label: "Start",
          eventType: "start",
          content: null,
          metadata: null,
          stepId: 0,
          parentStepId: null,
          spanId: null,
          timestamp: sortedEvents[0]?.timestamp || "",
          duration: null,
          timeSinceStart: 0,
          isLateEvent: false,
        },
      });

      edges.push({
        id: "e-start-0",
        source: "start",
        target: event.id,
        type: opts.edgeOptions.type,
        style: opts.edgeOptions.style,
        markerEnd: opts.edgeOptions.markerEnd,
      });
    }

    if (event.eventType === "llm_response") {
      lastLlmResponseId = event.id;
    }
    if (
      event.eventType !== "tool_call_request" &&
      event.eventType !== "tool_call_response" &&
      event.eventType !== "tool_result"
    ) {
      lastNonToolEventId = event.id;
    }
    lastVisibleEventId = event.id;
  });

  const lastEvent = lastVisibleEventId
    ? displayedEvents.find((event) => event.id === lastVisibleEventId)
    : undefined;
  if (lastEvent) {
    nodes.push({
      id: "end",
      type: "end",
      position: { x: opts.startX, y: opts.startY + nodes.length * opts.nodeSpacing },
      data: {
        label: "End",
        eventType: "end",
        content: null,
        metadata: null,
        stepId: lastEvent.stepId + 1,
        parentStepId: lastEvent.stepId,
        spanId: null,
        timestamp: lastEvent.timestamp,
        duration: null,
        timeSinceStart: (lastEvent.timeSinceStart ?? 0) + (lastEvent.duration ?? 0),
        isLateEvent: false,
      },
    });

    edges.push({
      id: `e-${lastEvent.id}-end`,
      source: lastEvent.id,
      target: "end",
      type: opts.edgeOptions.type,
      style: opts.edgeOptions.style,
      markerEnd: opts.edgeOptions.markerEnd,
    });
  }

  return { nodes, edges };
}

export function getEventSidebarData(event: TraceEvent): SidebarData {
  return eventHandlerRegistry.getSidebarData(event);
}

export function getEventTimelineData(event: TraceEvent): TimelineData {
  return eventHandlerRegistry.getTimelineData(event);
}

export function getTraceEventStats(events: TraceEvent[]): {
  totalEvents: number;
  llmCalls: number;
  toolCalls: number;
  errors: number;
  totalTokens: number;
  totalLatency: number;
} {
  const stats = {
    totalEvents: events.length,
    llmCalls: 0,
    toolCalls: 0,
    errors: 0,
    totalTokens: 0,
    totalLatency: 0,
  };

  events.forEach((event) => {
    switch (event.eventType) {
      case "llm_response":
      case "agent_message":
        stats.llmCalls++;
        if (event.metadata?.usage?.totalTokens) {
          stats.totalTokens += event.metadata.usage.totalTokens;
        }
        if (event.metadata?.latencyMs) {
          stats.totalLatency += event.metadata.latencyMs;
        }
        break;
      case "tool_call":
      case "tool_call_request":
      case "tool_call_response":
      case "tool_result":
        stats.toolCalls++;
        break;
      case "error":
        stats.errors++;
        break;
    }
  });

  return stats;
}

export function groupEventsByType(
  events: TraceEvent[]
): Record<string, TraceEvent[]> {
  const groups: Record<string, TraceEvent[]> = {};

  events.forEach((event) => {
    const type = event.eventType;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(event);
  });

  return groups;
}

export function getModelsUsed(events: TraceEvent[]): string[] {
  const models = new Set<string>();

  events.forEach((event) => {
    if (event.metadata?.model) {
      models.add(event.metadata.model);
    }
    if (event.metadata?.providerSlug) {
      models.add(`${event.metadata.providerSlug}/${event.metadata.model}`);
    }
  });

  return Array.from(models);
}

export function getToolsUsed(events: TraceEvent[]): string[] {
  const tools = new Set<string>();

  events.forEach((event) => {
    if (event.eventType === "tool_call_request" && event.content && typeof event.content === "object" && "name" in event.content) {
      tools.add(event.content.name as string);
    }
    if (event.metadata?.tool) {
      tools.add(event.metadata.tool as string);
    }
  });

  return Array.from(tools);
}

export { eventHandlerRegistry };
