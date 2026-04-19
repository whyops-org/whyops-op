import { Node, Edge } from "reactflow";

// ------------------------------------------------------------------
// DATA MODELS
// ------------------------------------------------------------------

export interface TraceSpan {
  id: string;
  type: "input" | "llm" | "logic" | "tool" | "output" | "end" | "rejected";
  title: string;
  tag: string;
  timestamp: string;
  duration?: string;
  cost?: string;
  icon?: string;
  status?: "active" | "success" | "warning" | "error";
  
  // Timeline/Content Data
  content?: {
    type: "json" | "text" | "tool-execution";
    label?: string;
    data?: Record<string, unknown>;
    text?: string;
    arguments?: Record<string, unknown>;
    result?: Record<string, unknown>;
    latencyContribution?: number;
  };

  // Graph Visualization Data
  position?: { x: number; y: number };
  graphData?: {
    label?: string;
    value?: string;
    badge?: string;
    name?: string;
    input?: string;
    status?: string;
  };
}

export interface Trace {
  id: string;
  agentId: string;
  status: "success" | "warning" | "error";
  timestamp: string;
  duration: string;
  tokens: number;
  cost: string;
  model: string;
  spans: TraceSpan[];
  edges: Edge[]; // Graph connections
  
  // Sidebar / Context Data
  contextWindow: string;
  memoryState: {
    shortTerm: { key: string; value: string }[];
    longTerm: { key: string; value: string }[];
  };
  availableTools: { name: string; description: string }[];
  decisionLogic: {
    confidenceScore: number;
    selectedAction: {
      name: string;
      type: string;
      description: string;
    };
    reasoning: string;
    rejectedAlternatives: { name: string; reason: string }[];
  };
}

export interface Agent {
  id: string;
  name: string;
  version: string;
  status: "active" | "warning" | "error" | "inactive";
  tracesCount: number;
  successRate: number;
  lastActive: string;
  icon: string;
  stats: {
    totalTraces: { value: number; trend: number };
    successRate: { value: number; suffix: string };
    avgDuration: { value: string; comparison: string };
    errorsToday: { value: number; status: string };
  };
  traceTimelineData: { time: string; success: number; warning: number; error: number }[];
  traces: Trace[]; // Nested traces
}

// ------------------------------------------------------------------
// MOCK DATA IMPLEMENTATION
// ------------------------------------------------------------------

const TRACE_1_SPANS: TraceSpan[] = [
  {
    id: "step-1",
    type: "input",
    title: "User Input",
    tag: "INPUT",
    timestamp: "0.0s",
    duration: "--",
    icon: "user",
    position: { x: 250, y: 100 },
    content: {
      type: "json",
      label: "PAYLOAD",
      data: {
        message: "How do I reset my password?",
        user_id: "u_882310",
        timestamp: "2023-10-27T10:00:00Z",
      },
    },
    graphData: {
      label: "USER INPUT",
      value: '"How do I reset my password?"',
    },
  },
  {
    id: "step-2",
    type: "llm",
    title: "Parse Intent",
    tag: "LLM",
    timestamp: "+0.2s",
    duration: "400ms",
    cost: "$ 0.002",
    icon: "brain",
    position: { x: 250, y: 250 },
    content: {
      type: "json",
      data: {
        intent: "reset_password",
        confidence: 0.98,
      },
    },
    graphData: {
      label: "DECISION",
      value: "Parse Intent",
      badge: "LLM",
    },
  },
  {
    id: "step-3",
    type: "logic",
    title: "Decision Router",
    tag: "LOGIC",
    timestamp: "+0.6s",
    duration: "100ms",
    icon: "git-branch",
    position: { x: 250, y: 350 },
    content: {
      type: "text",
      text: "Route: reset_password_flow",
    },
    graphData: {
      label: "ROUTER",
      value: "reset_password_flow",
    },
  },
  {
    id: "step-4",
    type: "tool",
    title: "Tool Call: reset_password_flow",
    tag: "TOOL",
    timestamp: "+0.7s",
    duration: "1.5s",
    cost: "$ 0.010",
    icon: "wrench",
    position: { x: 250, y: 450 },
    content: {
      type: "tool-execution",
      arguments: {
        action: "initiate_reset",
        target_email: "user@example.com",
        force: false,
      },
      result: {
        status: "success",
        reset_link: "https://auth.co/r/...",
        expires_in: 3600,
      },
      latencyContribution: 65,
    },
    graphData: {
      label: "TOOL CALL",
      name: "reset_password_flow",
      input: 'action: "initiate_reset"',
      status: "active",
    },
  },
  {
    id: "step-5",
    type: "output",
    title: "Final Response",
    tag: "OUTPUT",
    timestamp: "+2.2s",
    duration: "100ms",
    icon: "message-square",
    position: { x: 250, y: 600 },
    content: {
      type: "text",
      text: "I've sent a password reset link to your email.",
    },
    graphData: {
      label: "END",
    },
  },
];

const TRACE_1_EDGES: Edge[] = [
  { id: "e-start-1", source: "start", target: "step-1" },
  { id: "e1-2", source: "step-1", target: "step-2" },
  { id: "e2-3", source: "step-2", target: "step-3" },
  { id: "e3-4", source: "step-3", target: "step-4", animated: true, style: { stroke: "var(--primary)" } },
  { id: "e4-5", source: "step-4", target: "step-5", animated: true, style: { stroke: "var(--primary)" } },
];

const TRACE_1: Trace = {
  id: "trc_9a8b7c6d",
  agentId: "1",
  status: "success",
  timestamp: "Today, 18:04:22",
  duration: "2.45s",
  tokens: 340,
  cost: "$ 0.045",
  model: "GPT-4o",
  spans: TRACE_1_SPANS,
  edges: TRACE_1_EDGES,
  contextWindow: `System: You are a helpful assistant.
User: How do I reset my password?
... [Context truncated] ...`,
  memoryState: {
    shortTerm: [
      { key: "user_id", value: "u_882310" },
      { key: "intent", value: "reset_password" },
    ],
    longTerm: [],
  },
  availableTools: [
    { name: "reset_password_flow", description: "Initiates password reset process" },
    { name: "verify_email", description: "Checks if email exists" },
  ],
  decisionLogic: {
    confidenceScore: 98,
    selectedAction: {
      name: "reset_password_flow",
      type: "TOOL",
      description: "User explicitly asked for password reset.",
    },
    reasoning: `User intent classified as 'reset_password' with high confidence (0.98).
Required parameters (user_id) are present in context.
Policy allows automated reset for verified users.`,
    rejectedAlternatives: [
      { name: "send_kb_article", reason: "User request implies action, not just information." },
    ],
  },
};

// Additional Mock Traces (Simplified for brevity but structure maintained)
const TRACE_2: Trace = {
  ...TRACE_1,
  id: "trc_1x2y3z4a",
  status: "warning",
  timestamp: "Today, 18:02:15",
  duration: "4.12s",
  tokens: 890,
  spans: [], // Empty for now or duplicate TRACE_1_SPANS if needed
};

const TRACE_3: Trace = {
  ...TRACE_1,
  id: "trc_5f6g7h8j",
  status: "error",
  timestamp: "Today, 17:58:33",
  duration: "0.3s",
  tokens: 12,
  spans: [],
};

export const MOCK_DATA: { agents: Agent[] } = {
  agents: [
    {
      id: "1",
      name: "Agent Alpha",
      version: "v2.4.0-production",
      status: "active",
      tracesCount: 426,
      successRate: 98,
      lastActive: "2m ago",
      icon: "user",
      stats: {
        totalTraces: { value: 847, trend: 12 },
        successRate: { value: 96.2, suffix: "last 24h" },
        avgDuration: { value: "2.8s", comparison: "-0.4s vs avg" },
        errorsToday: { value: 12, status: "Needs Review" },
      },
      traceTimelineData: [
        { time: "9AM", success: 65, warning: 15, error: 5 },
        { time: "10AM", success: 75, warning: 0, error: 0 },
        { time: "11AM", success: 85, warning: 20, error: 0 },
        { time: "12PM", success: 30, warning: 0, error: 0 },
        { time: "1PM", success: 45, warning: 0, error: 35 },
        { time: "2PM", success: 90, warning: 0, error: 0 },
        { time: "3PM", success: 80, warning: 10, error: 0 },
        { time: "4PM", success: 40, warning: 0, error: 0 },
        { time: "5PM", success: 95, warning: 0, error: 25 },
        { time: "6PM", success: 60, warning: 0, error: 0 },
      ],
      traces: [TRACE_1, TRACE_2, TRACE_3],
    },
    {
      id: "2",
      name: "CustomerSupport_Bot",
      version: "v1.2-staging",
      status: "warning",
      tracesCount: 1205,
      successRate: 89,
      lastActive: "15s ago",
      icon: "message",
      stats: {
        totalTraces: { value: 1205, trend: -5 },
        successRate: { value: 89.0, suffix: "last 24h" },
        avgDuration: { value: "1.2s", comparison: "+0.2s vs avg" },
        errorsToday: { value: 45, status: "Critical" },
      },
      traceTimelineData: [],
      traces: [],
    },
    {
      id: "3",
      name: "DataProcessor_v2",
      version: "v3.0.0-production",
      status: "active",
      tracesCount: 222,
      successRate: 99,
      lastActive: "1h ago",
      icon: "database",
      stats: {
          totalTraces: { value: 222, trend: 5 },
          successRate: { value: 99.0, suffix: "last 24h" },
          avgDuration: { value: "0.5s", comparison: "-0.1s vs avg" },
          errorsToday: { value: 0, status: "Good" },
      },
      traceTimelineData: [],
      traces: [],
    },
    {
      id: "4",
      name: "Search_Index_Agent",
      version: "v1.8.2-production",
      status: "active",
      tracesCount: 854,
      successRate: 99.9,
      lastActive: "3m ago",
      icon: "search",
      stats: {
          totalTraces: { value: 854, trend: 2 },
          successRate: { value: 99.9, suffix: "last 24h" },
          avgDuration: { value: "0.1s", comparison: "0s vs avg" },
          errorsToday: { value: 0, status: "Good" },
      },
      traceTimelineData: [],
      traces: [],
    },
    {
      id: "5",
      name: "Billing_Daemon",
      version: "v4.1-staging",
      status: "warning",
      tracesCount: 15,
      successRate: 78,
      lastActive: "5h ago",
      icon: "credit-card",
      stats: {
          totalTraces: { value: 15, trend: 0 },
          successRate: { value: 78.0, suffix: "last 24h" },
          avgDuration: { value: "5.5s", comparison: "+2s vs avg" },
          errorsToday: { value: 3, status: "Warning" },
      },
      traceTimelineData: [],
      traces: [],
    },
  ],
};

// Helper Functions
export function getAgent(id: string): Agent | undefined {
  return MOCK_DATA.agents.find((a) => a.id === id);
}

export function getDashboardStats() {
  const agents = MOCK_DATA.agents;
  const totalAgents = agents.length;
  const activeTraces = agents.reduce((acc, agent) => acc + agent.tracesCount, 0);
  
  // Calculate weighted success rate
  const totalSuccessWeighted = agents.reduce((acc, agent) => acc + (agent.successRate * agent.tracesCount), 0);
  const globalSuccessRate = activeTraces > 0 ? (totalSuccessWeighted / activeTraces).toFixed(1) : "0.0";

  return {
    totalAgents,
    activeTraces,
    successRate: {
      value: Number(globalSuccessRate),
      trend: "+1.6%", // Mock trend
      isPositive: true,
      subtitle: "vs previous week",
    },
    avgLatency: {
      value: "2.3s", // Mock global average
      trend: "+0.4s",
      isPositive: false,
      subtitle: "High load detected",
    },
  };
}

export function getDashboardChartData() {
  return [
    { day: "MON", value: 82 },
    { day: "TUE", value: 88 },
    { day: "WED", value: 92 },
    { day: "THU", value: 86 },
    { day: "FRI", value: 89 },
    { day: "SAT", value: 94 },
    { day: "SUN", value: 96 },
  ];
}

export const AGENTS_TABLE_TEXT = {
  title: "Agents List",
  searchPlaceholder: "Search agents...",
  sortPlaceholder: "Sort by",
  sortOptions: [
    { value: "last-7-days", label: "Last 7 days" },
    { value: "last-30-days", label: "Last 30 days" },
    { value: "all-time", label: "All time" },
  ],
  columns: ["Name", "Status", "Traces", "Success", "Last Active", "Actions"],
  actionColumn: "Actions",
  statusLabels: {
    active: "Active",
    warning: "Warning",
    error: "Error",
    inactive: "Inactive",
  },
  actionLabel: "More options",
  countLabel: (filtered: number, total: number) =>
    `Showing ${filtered} of ${total} agents`,
};

export function getTrace(agentId: string, traceId: string): Trace | undefined {
  const agent = getAgent(agentId);
  return agent?.traces.find((t) => t.id === traceId);
}

export function getTraceNodes(trace: Trace): Node[] {
  const nodes: Node[] = [
    {
      id: "start",
      type: "start",
      position: { x: 250, y: 0 },
      data: { label: "Start" },
    },
  ];

  trace.spans.forEach((step) => {
    let nodeType = "default";
    if (step.type === "input") nodeType = "userInput";
    else if (step.type === "llm") nodeType = "decision";
    else if (step.type === "logic") nodeType = "decision";
    else if (step.type === "tool") nodeType = "toolCall";
    else if (step.type === "output") nodeType = "end";

    if (step.type === "output") {
      nodes.push({
        id: step.id,
        type: "end",
        position: step.position || { x: 250, y: 0 },
        data: {},
      });
      return;
    }

    nodes.push({
      id: step.id,
      type: nodeType,
      position: step.position || { x: 250, y: 0 },
      data: {
        ...step.graphData,
        value: step.graphData?.value || step.title,
      },
    });
  });

  return nodes;
}

export function getTraceEdges(trace: Trace): Edge[] {
  return trace.edges;
}
