"use client";

import dagre from "dagre";
import { useMemo } from "react";

import {
  DecisionNode,
  EndNode,
  ErrorNode,
  LLMResponseNode,
  LLMThinkingNode,
  RejectedNode,
  StartNode,
  ToolCallNode,
  ToolResultNode,
  UserInputNode,
} from "@/components/traces/custom-nodes";
import { calculateTraceCost, getPrimaryCostRate } from "@/lib/trace-cost";
import { convertEventsToNodesAndEdges } from "@/lib/trace-utils";
import type { TraceDetail } from "@/stores/traceDetailStore";
import {
  Background,
  Controls,
  Edge, MarkerType, Node, ReactFlow
} from "reactflow";
import "reactflow/dist/style.css";
import { defaultTraceEventParsers } from "@/lib/trace-event-parsers";

// Register all custom node types
const nodeTypes = {
  start: StartNode,
  userInput: UserInputNode,
  llmResponse: LLMResponseNode,
  llmThinking: LLMThinkingNode,
  decision: DecisionNode,
  toolCall: ToolCallNode,
  toolResult: ToolResultNode,
  error: ErrorNode,
  rejected: RejectedNode,
  end: EndNode,
};

// Custom edges style
const defaultEdgeOptions = {
  type: "smoothstep" as const,
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: "var(--muted-foreground)",
  },
  style: {
    strokeWidth: 1.5,
    stroke: "var(--muted-foreground)",
  },
  animated: false,
};

interface TraceCanvasProps {
  trace: TraceDetail;
}

export function TraceCanvas({ trace }: TraceCanvasProps) {
  const { nodes, edges } = useMemo(() => {
    if (!trace.events || trace.events.length === 0) {
      return { nodes: [] as Node[], edges: [] as Edge[] };
    }
    const filteredEvents = trace.events.map((event) => {
      //if content is array remove content with role system
      if (Array.isArray(event.content)) {
        const filteredContent = event.content.filter((item) => {
          if (!isRecord(item)) {
            return true;
          }
          const role = typeof item.role === "string" ? item.role : null;
          return role !== "system";
        });
        return {
          ...event,
          content: filteredContent,
        };
      }
      return event;
    });
    const pricing = getPrimaryCostRate(trace.cost ?? null);
    const { perEvent } = calculateTraceCost(filteredEvents, pricing);
    const enrichedEvents = filteredEvents.map((event) => {
      const cost = perEvent.get(event.id);
      if (!cost) return event;
      return {
        ...event,
        metadata: {
          ...(event.metadata ?? {}),
          costUsd: cost,
        },
      };
    });
    const convertedData = convertEventsToNodesAndEdges(enrichedEvents, {
      parser: defaultTraceEventParsers,
    });
    const layoutedNodes = applyAutoLayout(convertedData.nodes, convertedData.edges);
    return { nodes: layoutedNodes, edges: convertedData.edges };
  }, [trace.events, trace.cost]);

  if (!trace.events || trace.events.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-2/10">
        <p className="text-muted-foreground">No events in this trace</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-surface-2/10">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.2, minZoom: 0.45 }}
        attributionPosition="bottom-right"
        className="bg-background/90"
        minZoom={0.45}
        maxZoom={1.6}
      >
        <Background color="var(--border)" gap={24} size={1} />
        <Controls
          position="bottom-left"
          className="[&>button]:h-8 [&>button]:w-8 [&>button]:rounded-sm [&>button]:border-border/60 [&>button]:bg-card [&>button]:text-muted-foreground [&>button:hover]:text-foreground"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  start: { width: 120, height: 60 },
  end: { width: 80, height: 80 },
  userInput: { width: 256, height: 145 },
  llmResponse: { width: 288, height: 150 },
  decision: { width: 288, height: 150 },
  toolCall: { width: 288, height: 165 },
  toolResult: { width: 288, height: 155 },
  error: { width: 256, height: 145 },
  rejected: { width: 256, height: 145 },
};

function applyAutoLayout(nodes: Node[], edges: Edge[]): Node[] {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "TB",
    nodesep: 40,
    ranksep: 80,
    marginx: 20,
    marginy: 20,
  });

  nodes.forEach((node) => {
    const fallback = NODE_DIMENSIONS[node.type ?? ""] || { width: 240, height: 140 };
    const width = typeof node.width === "number"
      ? node.width
      : (typeof node.style?.width === "number" ? node.style.width : fallback.width);
    const height = typeof node.height === "number"
      ? node.height
      : (typeof node.style?.height === "number" ? node.style.height : fallback.height);
    graph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });

  dagre.layout(graph);

  return nodes.map((node) => {
    const fallback = NODE_DIMENSIONS[node.type ?? ""] || { width: 240, height: 140 };
    const width = typeof node.width === "number"
      ? node.width
      : (typeof node.style?.width === "number" ? node.style.width : fallback.width);
    const height = typeof node.height === "number"
      ? node.height
      : (typeof node.style?.height === "number" ? node.style.height : fallback.height);
    const positionedNode = graph.node(node.id) as { x: number; y: number } | undefined;
    if (!positionedNode) {
      return node;
    }

    return {
      ...node,
      position: {
        x: positionedNode.x - width / 2,
        y: positionedNode.y - height / 2,
      },
    };
  });
}
