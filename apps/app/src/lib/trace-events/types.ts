import type { TraceEvent } from "@/stores/traceDetailStore";

export interface TraceNodeDataBase {
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
  [key: string]: unknown;
}

export type CanvasNodeData = TraceNodeDataBase & {
  contentText: string;
  contentPreview?: string;
  truncated?: boolean;
  nodeType: string;
  highlight: boolean;
};

export type SidebarData = {
  title: string;
  subtitle?: string;
  sections: SidebarSection[];
};

export type SidebarSection = {
  title: string;
  type: "text" | "json" | "table" | "metrics" | "code";
  content: string | Record<string, unknown> | Array<Record<string, unknown>> | SidebarMetric[];
  collapsible?: boolean;
  defaultOpen?: boolean;
};

export type SidebarMetric = {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "neutral";
};

export type TimelineData = {
  title: string;
  description: string;
  icon?: string;
  status: "pending" | "running" | "completed" | "error";
  timestamp: string;
  duration?: number;
  metadata?: Record<string, unknown>;
};

export interface NodeConfig {
  nodeType: string;
  label: string;
  highlight?: boolean;
}

export interface EventHandler {
  eventType: string;
  nodeConfig: NodeConfig;
  getCanvasData: (event: TraceEvent) => CanvasNodeData;
  getSidebarData: (event: TraceEvent) => SidebarData;
  getTimelineData: (event: TraceEvent) => TimelineData;
  shouldDisplay?: (event: TraceEvent) => boolean;
}

export type EventHandlerMap = Map<string, EventHandler>;

export const DEFAULT_NODE_CONFIG: NodeConfig = {
  nodeType: "default",
  label: "Event",
  highlight: false,
};

export const DEFAULT_TRUNCATION_LENGTH = 200;
export const DEFAULT_PREVIEW_LENGTH = 100;

export type { TraceEvent };
