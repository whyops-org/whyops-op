import type { JudgeDimension } from "@/stores/judgeStore";

export type JudgeMode = "quick" | "standard" | "deep";
export type DimensionTab = "all" | JudgeDimension;
export type FindingCategory = "all" | "critical" | "high" | "medium" | "low" | "patches";
export type FindingDetailTab = "overview" | "issues" | "patches";

export interface PromptAwareDiff {
  oldValue: string;
  newValue: string;
  leftTitle: string;
  rightTitle: string;
  foundInPrompt: boolean;
}

export interface PatchSource {
  id: string;
  title: string;
  text: string;
  kind:
    | "system_prompt"
    | "tool_description"
    | "tool_input_schema"
    | "tool_output_schema"
    | "tool_config"
    | "generic";
  toolName?: string;
}

export interface PatchSourceResolution {
  source: PatchSource;
  foundInSource: boolean;
}
