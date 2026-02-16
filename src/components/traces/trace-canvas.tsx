"use client";

import { useMemo } from "react";

import {
  DecisionNode,
  EndNode,
  ErrorNode,
  LLMResponseNode,
  RejectedNode,
  StartNode,
  ToolCallNode,
  ToolResultNode,
  UserInputNode,
} from "@/components/traces/custom-nodes";
import { convertEventsToNodesAndEdges } from "@/lib/trace-utils";
import type { TraceDetail } from "@/stores/traceDetailStore";
import {
  Background,
  Controls, Edge, MarkerType, Node, ReactFlow
} from "reactflow";
import "reactflow/dist/style.css";

// Register all custom node types
const nodeTypes = {
  start: StartNode,
  userInput: UserInputNode,
  llmResponse: LLMResponseNode,
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
    strokeWidth: 2,
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
    return convertEventsToNodesAndEdges(trace.events);
  }, [trace.events]);

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
        attributionPosition="bottom-right"
        className="bg-background"
        minZoom={0.5}
        maxZoom={1.5}
      >
        <Background color="var(--border)" gap={20} size={1} />
        <Controls className="bg-surface-2 border-border/50 text-foreground fill-foreground" />
      </ReactFlow>
    </div>
  );
}
