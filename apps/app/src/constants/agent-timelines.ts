export const DEFAULT_TIMELINE_PERIOD = 7;

export const AGENT_TIMELINE_PERIOD_OPTIONS = [
  { value: "7", label: "Last 7 Days" },
  { value: "14", label: "Last 14 Days" },
  { value: "30", label: "Last 30 Days" },
] as const;

export const SUCCESS_RATE_TIMELINE_TITLE = "Trace Timeline";
export const SUCCESS_RATE_TIMELINE_LABEL = "Success Rate";
export const SUCCESS_RATE_EMPTY_TITLE = "No timeline data";
export const SUCCESS_RATE_EMPTY_DESCRIPTION =
  "No traces recorded in the selected timeframe.";

export const TRACE_COUNT_TIMELINE_TITLE = "Trace Count";
export const TRACE_COUNT_TIMELINE_LABEL = "Trace Count";
export const TRACE_COUNT_EMPTY_TITLE = "No trace data";
export const TRACE_COUNT_EMPTY_DESCRIPTION =
  "No traces recorded in the selected timeframe.";
