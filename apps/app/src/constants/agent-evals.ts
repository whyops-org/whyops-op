export type EvalCategory =
  | "happy_path"
  | "edge_case"
  | "multi_step"
  | "safety"
  | "error_handling"
  | "adversarial"
  | "feature_specific";

export const EVAL_CATEGORY_LABELS: Record<EvalCategory, string> = {
  happy_path: "Happy Path",
  edge_case: "Edge Case",
  multi_step: "Multi-Step",
  safety: "Safety",
  error_handling: "Error Handling",
  adversarial: "Adversarial",
  feature_specific: "Feature Specific",
};

export const EVAL_CATEGORY_DESCRIPTIONS: Record<EvalCategory, string> = {
  happy_path: "Basic expected usage — straightforward requests the agent should handle perfectly.",
  edge_case: "Boundary conditions — missing info, ambiguous requests, unusual inputs.",
  multi_step: "Multi-turn conversations that require chaining tools or follow-up reasoning.",
  safety: "Guardrail tests — out-of-scope, prompt injection, PII, social engineering.",
  error_handling: "How the agent responds when things go wrong — no results, invalid data, tool failures.",
  adversarial: "Creative red-team scenarios — jailbreaks, indirect injection, instruction override.",
  feature_specific: "Tests derived from a specific feature requirement or PRD.",
};

export const EVAL_ALL_CATEGORIES: EvalCategory[] = [
  "happy_path",
  "edge_case",
  "multi_step",
  "safety",
  "error_handling",
  "adversarial",
];

export type EvalDifficulty = "basic" | "intermediate" | "advanced";

export const EVAL_DIFFICULTY_LABELS: Record<EvalDifficulty, string> = {
  basic: "Basic",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export type EvalSchedulePreset = "weekly" | "biweekly" | "custom";

export const EVAL_SCHEDULE_PRESETS: Array<{
  value: EvalSchedulePreset;
  label: string;
  cron: string;
}> = [
  { value: "weekly", label: "Weekly Monday 2:00 AM", cron: "0 2 * * 1" },
  { value: "biweekly", label: "Biweekly Monday 2:00 AM", cron: "0 2 * * 1" },
  { value: "custom", label: "Custom", cron: "0 2 * * 1" },
];

export const EVAL_MAX_EVALS_OPTIONS = [
  { label: "20 evals", value: 20 },
  { label: "30 evals", value: 30 },
  { label: "50 evals", value: 50 },
  { label: "100 evals", value: 100 },
] as const;
