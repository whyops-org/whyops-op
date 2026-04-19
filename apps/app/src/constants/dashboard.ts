export const DEFAULT_AGENT_USAGE_COUNT = 5;

export const AGENT_USAGE_COUNT_OPTIONS = [
  { value: 3, label: "Top 3" },
  { value: 5, label: "Top 5" },
  { value: 10, label: "Top 10" },
  { value: 20, label: "Top 20" },
] as const;

export const AGENT_USAGE_CARD_TITLE = "Agent Usage";
export const AGENT_USAGE_CARD_SUBTITLE = "Top agents by trace volume";
export const AGENT_USAGE_EMPTY_TITLE = "No usage data";
export const AGENT_USAGE_EMPTY_DESCRIPTION =
  "Agent usage will appear once traces are recorded.";

export const AGENT_USAGE_CHART_COLORS = [
  "var(--primary)",
  "var(--accent)",
  "var(--warning)",
  "var(--destructive)",
  "var(--secondary-foreground)",
  "var(--muted-foreground)",
  "var(--accent-strong)",
  "var(--ink-muted)",
];
