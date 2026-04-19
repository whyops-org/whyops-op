import type { FindingCategory, JudgeMode } from "./types";

export const MODE_LABELS: Record<JudgeMode, string> = {
  quick: "Quick",
  standard: "Standard",
  deep: "Deep",
};

export const FINDING_CATEGORY_LABELS: Record<FindingCategory, string> = {
  all: "All",
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  patches: "With Patches",
};

export const FINDING_CATEGORIES: FindingCategory[] = [
  "all",
  "critical",
  "high",
  "medium",
  "low",
  "patches",
];

export const ISSUES_PER_PAGE = 5;

export const STREAMING_STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  running: "Streaming",
  completed: "Complete",
  failed: "Failed",
};

export const JUDGE_SKELETON_DIMENSION_CARD_COUNT = 3;
