import type { Node, Edge, MarkerType } from "reactflow";

import type { TraceEvent } from "@/stores/traceDetailStore";

/**
 * Configuration for node type mapping
 * Extend this to add more event types or customize node types
 */
interface NodeTypeConfig {
  /** React Flow node type */
  nodeType: string;
  /** Display label for the node */
  label: string;
  /** Whether this node type should be highlighted */
  highlight?: boolean;
}

/**
 * Configuration for event type to node type mapping
 * Add new event types here to customize how they're rendered
 */
const EVENT_TYPE_CONFIG: Record<string, NodeTypeConfig> = {
  user_message: {
    nodeType: "userInput",
    label: "User Input",
    highlight: true,
  },
  llm_response: {
    nodeType: "llmResponse",
    label: "LLM Response",
    highlight: true,
  },
  tool_call: {
    nodeType: "toolCall",
    label: "Tool Call",
    highlight: true,
  },
  tool_call_request: {
    nodeType: "toolCall",
    label: "Tool Request",
    highlight: true,
  },
  tool_call_response: {
    nodeType: "toolResult",
    label: "Tool Result",
    highlight: false,
  },
  error: {
    nodeType: "error",
    label: "Error",
    highlight: true,
  },
  agent_message: {
    nodeType: "llmResponse",
    label: "Agent Message",
    highlight: true,
  },
  system_message: {
    nodeType: "start",
    label: "System",
    highlight: false,
  },
};

/**
 * Default node configuration for unknown event types
 */
const DEFAULT_NODE_CONFIG: NodeTypeConfig = {
  nodeType: "default",
  label: "Event",
  highlight: false,
};

/**
 * Node data structure for trace events
 */
export interface TraceNodeData {
  label: string;
  eventType: string;
  content: TraceEvent["content"];
  metadata: TraceEvent["metadata"];
  stepId: number;
  parentStepId: number | null;
  spanId: string | null;
  timestamp: string;
  duration: number | null;
  timeSinceStart: number;
  isLateEvent: boolean;
  contentText?: string;
  metadataSummary?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Options for converting trace events to nodes and edges
 */
export interface ConvertTraceOptions {
  /** Vertical spacing between nodes */
  nodeSpacing?: number;
  /** Starting X position for nodes */
  startX?: number;
  /** Starting Y position for nodes */
  startY?: number;
  /** Custom edge options */
  edgeOptions?: Partial<Pick<Edge, "type" | "style" | "markerEnd">>;
  /** Custom node width */
  nodeWidth?: number;
}

/**
 * Default conversion options
 */
const DEFAULT_OPTIONS: Required<ConvertTraceOptions> = {
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

/**
 * Get node configuration for an event type
 * Can be extended to support custom event types
 */
function getNodeConfig(eventType: string): NodeTypeConfig {
  return EVENT_TYPE_CONFIG[eventType] || DEFAULT_NODE_CONFIG;
}

/**
 * Extract content text from an event for display
 */
function extractContentText(content: TraceEvent["content"]): string {
  if (!content) return "";

  if (typeof content === "string") return content;

  if (content.text) return content.text;

  // Tool call - show tool name and arguments
  if (content.name) {
    if (content.arguments) {
      try {
        const args = JSON.stringify(content.arguments);
        return `${content.name}(${args})`;
      } catch {
        return content.name;
      }
    }
    return content.name;
  }

  return JSON.stringify(content);
}

/**
 * Extract metadata summary for display
 */
function extractMetadataSummary(metadata: TraceEvent["metadata"]): Record<string, unknown> {
  if (!metadata) return {};

  // Extract common fields for display
  const summary: Record<string, unknown> = {};

  if (metadata.model) summary.model = metadata.model;
  if (metadata.provider) summary.provider = metadata.provider;
  if (metadata.providerSlug) summary.provider = metadata.providerSlug;
  if (metadata.usage) summary.usage = metadata.usage;
  if (metadata.latencyMs) summary.latency = `${metadata.latencyMs}ms`;
  if (metadata.tool_id) summary.toolId = metadata.tool_id;

  return summary;
}

/**
 * Convert trace events to React Flow nodes and edges
 *
 * This function is scalable - to add new event types or customize node behavior:
 * 1. Add the event type to EVENT_TYPE_CONFIG above
 * 2. Add a corresponding node component in custom-nodes.tsx
 * 3. Register the node type in trace-canvas.tsx
 *
 * @param events - Array of trace events from the API
 * @param options - Optional configuration for the conversion
 * @returns Object containing nodes and edges for React Flow
 */
export function convertEventsToNodesAndEdges(
  events: TraceEvent[],
  options: ConvertTraceOptions = {}
): { nodes: Node<TraceNodeData>[]; edges: Edge[] } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const nodes: Node<TraceNodeData>[] = [];
  const edges: Edge[] = [];

  if (!events || events.length === 0) {
    return { nodes, edges };
  }

  // Sort events by timestamp to ensure proper ordering
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Create a map for quick lookup of events by stepId
  const eventsByStepId = new Map<number, TraceEvent>();
  sortedEvents.forEach((event) => {
    eventsByStepId.set(event.stepId, event);
  });

  // Track which stepIds we've already created nodes for
  const processedStepIds = new Set<number>();

  // Process each event
  sortedEvents.forEach((event, index) => {
    if (processedStepIds.has(event.stepId)) {
      return;
    }
    processedStepIds.add(event.stepId);

    const config = getNodeConfig(event.eventType);
    const yPosition = opts.startY + index * opts.nodeSpacing;

    // Create node data
    const nodeData: TraceNodeData = {
      label: config.label,
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
      // Additional extracted data for display
      contentText: extractContentText(event.content),
      metadataSummary: extractMetadataSummary(event.metadata),
    };

    // Create the node
    const node: Node<TraceNodeData> = {
      id: event.id,
      type: config.nodeType,
      position: { x: opts.startX, y: yPosition },
      data: nodeData,
    };

    nodes.push(node);

    // Create edge from parent or start node
    if (event.parentStepId && eventsByStepId.has(event.parentStepId)) {
      const parentEvent = eventsByStepId.get(event.parentStepId)!;

      edges.push({
        id: `e-${parentEvent.id}-${event.id}`,
        source: parentEvent.id,
        target: event.id,
        type: opts.edgeOptions.type,
        style: opts.edgeOptions.style,
        markerEnd: opts.edgeOptions.markerEnd,
      });
    } else if (index === 0) {
      // First node connects to start
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
  });

  // Add end node
  const lastEvent = sortedEvents[sortedEvents.length - 1];
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

/**
 * Get statistics from trace events
 */
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
        stats.toolCalls++;
        break;
      case "error":
        stats.errors++;
        break;
    }
  });

  return stats;
}

/**
 * Group events by type for display
 */
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

/**
 * Get unique models used in trace events
 */
export function getModelsUsed(events: TraceEvent[]): string[] {
  const models = new Set<string>();

  events.forEach((event) => {
    if (event.metadata?.model) {
      models.add(event.metadata.model);
    }
    if (event.metadata?.providerSlug) {
      // Create a slug format for provider/model
      models.add(`${event.metadata.providerSlug}/${event.metadata.model}`);
    }
  });

  return Array.from(models);
}

/**
 * Get unique tools used in trace events
 */
export function getToolsUsed(events: TraceEvent[]): string[] {
  const tools = new Set<string>();

  events.forEach((event) => {
    if (event.eventType === "tool_call" && event.content?.name) {
      tools.add(event.content.name);
    }
  });

  return Array.from(tools);
}
