export const AGENT_DATA = [
  {
    id: "1",
    name: "Agent Alpha",
    version: "v2.4.0-production",
    status: "active" as const,
    traces: 426,
    successRate: 98,
    lastActive: "2m ago",
    icon: "user",
  },
  {
    id: "2",
    name: "CustomerSupport_Bot",
    version: "v1.2-staging",
    status: "warning" as const,
    traces: 1205,
    successRate: 89,
    lastActive: "15s ago",
    icon: "message",
  },
  {
    id: "3",
    name: "DataProcessor_v2",
    version: "v3.0.0-production",
    status: "active" as const,
    traces: 222,
    successRate: 99,
    lastActive: "1h ago",
    icon: "database",
  },
  {
    id: "4",
    name: "Search_Index_Agent",
    version: "v1.8.2-production",
    status: "active" as const,
    traces: 854,
    successRate: 99.9,
    lastActive: "3m ago",
    icon: "search",
  },
  {
    id: "5",
    name: "Billing_Daemon",
    version: "v4.1-staging",
    status: "warning" as const,
    traces: 15,
    successRate: 78,
    lastActive: "5h ago",
    icon: "credit-card",
  },
];

export const STATS_DATA = {
  totalAgents: 24,
  activeTraces: 1847,
  successRate: {
    value: 94.2,
    trend: "+1.6%",
    isPositive: true,
    subtitle: "vs previous week",
  },
  avgLatency: {
    value: "2.3s",
    trend: "+0.4s",
    isPositive: false,
    subtitle: "High load detected",
  },
};

export const CHART_DATA = [
  { day: "MON", value: 82 },
  { day: "TUE", value: 88 },
  { day: "WED", value: 92 },
  { day: "THU", value: 86 },
  { day: "FRI", value: 89 },
  { day: "SAT", value: 94 },
  { day: "SUN", value: 96 },
];

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
