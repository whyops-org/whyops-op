export type AgentAnalysisMode = "quick" | "standard" | "deep";
export type AgentAnalysisDimension =
  | "intent_precision"
  | "followup_repair"
  | "answer_completeness_clarity"
  | "tool_routing_quality"
  | "tool_invocation_quality"
  | "tool_output_utilization"
  | "reliability_recovery"
  | "latency_cost_efficiency"
  | "conversation_ux";

export const AGENT_ANALYSIS_MODE_LABELS: Record<AgentAnalysisMode, string> = {
  quick: "Quick",
  standard: "Standard",
  deep: "Deep",
};

export const AGENT_ANALYSIS_LOOKBACK_OPTIONS = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 14 days", value: 14 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 60 days", value: 60 },
  { label: "Last 90 days", value: 90 },
] as const;

export const AGENT_ANALYSIS_DIMENSION_LABELS: Record<AgentAnalysisDimension, string> = {
  intent_precision: "Intent Precision",
  followup_repair: "Follow-up Repair",
  answer_completeness_clarity: "Answer Completeness & Clarity",
  tool_routing_quality: "Tool Routing Quality",
  tool_invocation_quality: "Tool Invocation Quality",
  tool_output_utilization: "Tool Output Utilization",
  reliability_recovery: "Reliability & Recovery",
  latency_cost_efficiency: "Latency & Cost Efficiency",
  conversation_ux: "Conversation UX",
};

export const AGENT_ANALYSIS_DIMENSION_DESCRIPTIONS: Record<AgentAnalysisDimension, string> = {
  intent_precision: "How well the agent understands user goals on initial turns.",
  followup_repair: "How effectively the agent resolves clarification or correction follow-ups.",
  answer_completeness_clarity:
    "Whether answers are complete, direct, and clear for user needs.",
  tool_routing_quality: "Whether the agent chooses tools only when needed.",
  tool_invocation_quality: "How reliable tool call arguments and retries are.",
  tool_output_utilization: "How accurately tool outputs are integrated into answers.",
  reliability_recovery: "How well the agent recovers from failures and degraded paths.",
  latency_cost_efficiency: "Latency and token efficiency relative to user value.",
  conversation_ux: "Turn economy, coherence, and overall conversation quality.",
};

export const AGENT_ANALYSIS_ALL_DIMENSIONS: AgentAnalysisDimension[] = [
  "intent_precision",
  "followup_repair",
  "answer_completeness_clarity",
  "tool_routing_quality",
  "tool_invocation_quality",
  "tool_output_utilization",
  "reliability_recovery",
  "latency_cost_efficiency",
  "conversation_ux",
];

export type AgentAnalysisSchedulePreset = "daily" | "weekdays" | "custom";

export const AGENT_ANALYSIS_SCHEDULE_PRESETS: Array<{
  value: AgentAnalysisSchedulePreset;
  label: string;
  cron: string;
}> = [
  { value: "daily", label: "Daily 9:00 AM", cron: "0 9 * * *" },
  { value: "weekdays", label: "Weekdays 9:00 AM", cron: "0 9 * * 1-5" },
  { value: "custom", label: "Custom", cron: "0 9 * * *" },
];
