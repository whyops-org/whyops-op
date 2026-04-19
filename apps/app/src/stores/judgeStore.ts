import { create } from "zustand";

import { apiClient } from "@/lib/api-client";
import { useConfigStore } from "./configStore";
import { useTraceDetailStore } from "./traceDetailStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JudgeDimension =
  | "step_correctness"
  | "tool_choice"
  | "prompt_quality"
  | "tool_description"
  | "cost_efficiency";

export const ALL_DIMENSIONS: JudgeDimension[] = [
  "step_correctness",
  "tool_choice",
  "prompt_quality",
  "tool_description",
  "cost_efficiency",
];

export const DIMENSION_LABELS: Record<JudgeDimension, string> = {
  step_correctness: "Step Correctness",
  tool_choice: "Tool Choice",
  prompt_quality: "Prompt Quality",
  tool_description: "Tool Description",
  cost_efficiency: "Cost Efficiency",
};

export interface JudgeIssue {
  code: string;
  detail: string;
}

export interface JudgePatch {
  location?: string;
  original: string;
  suggested: string;
  rationale: string;
}

export interface JudgeRecommendation {
  action: string;
  detail: string;
  patches?: JudgePatch[];
}

export interface JudgeFinding {
  id: string;
  analysisId: string;
  stepId?: number | null;
  dimension: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  evidence: {
    score: number;
    issues: JudgeIssue[];
    [key: string]: unknown;
  };
  recommendation: JudgeRecommendation;
  createdAt: string;
  updatedAt: string;
}

export interface DimensionDetail {
  dimension: JudgeDimension;
  score: number;
  issueCount: number;
  patchCount: number;
  skipped: boolean;
  skipReason?: string;
}

export interface JudgeSummary {
  overallScore: number;
  dimensionScores: Record<string, number>;
  totalIssues: number;
  totalPatches: number;
  bySeverity: Record<string, number>;
  dimensionDetails: DimensionDetail[];
  checkpoint?: {
    key: string;
    sequence: number;
    at: string;
    data?: Record<string, unknown>;
  };
}

export interface JudgeResult {
  id: string;
  traceId: string;
  status: string;
  rubricVersion: string;
  judgeModel: string;
  mode: string;
  summary: JudgeSummary;
  findings: JudgeFinding[];
}

export interface PastAnalysis {
  id: string;
  traceId: string;
  status: string;
  rubricVersion: string;
  judgeModel: string | null;
  mode: string;
  startedAt: string;
  finishedAt: string | null;
  summary: JudgeSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface RunJudgeOptions {
  dimensions?: JudgeDimension[];
  judgeModel?: string;
  mode?: "quick" | "standard" | "deep";
}

interface JudgeRunStreamChunk {
  success: boolean;
  analysis?: JudgeResult;
  error?: string;
}

async function parseNdjsonStream(
  stream: ReadableStream<Uint8Array>,
  onChunk: (chunk: JudgeRunStreamChunk) => void
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parsed = JSON.parse(trimmed) as JudgeRunStreamChunk;
      onChunk(parsed);
    }
  }

  const tail = buffer.trim();
  if (tail) {
    const parsed = JSON.parse(tail) as JudgeRunStreamChunk;
    onChunk(parsed);
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface JudgeState {
  judgeResult: JudgeResult | null;
  pastAnalyses: PastAnalysis[];
  isRunning: boolean;
  isLoading: boolean;
  error: string | null;

  runJudge: (traceId: string, options?: RunJudgeOptions) => Promise<JudgeResult | null>;
  fetchPastAnalyses: (traceId: string) => Promise<void>;
  fetchAnalysisDetail: (id: string) => Promise<JudgeResult | null>;
  reset: () => void;
}

export const useJudgeStore = create<JudgeState>()((set) => ({
  judgeResult: null,
  pastAnalyses: [],
  isRunning: false,
  isLoading: false,
  error: null,

  runJudge: async (traceId: string, options?: RunJudgeOptions) => {
    const config = useConfigStore.getState().config;
    const apiKey = useTraceDetailStore.getState().apiKey;

    if (!config?.analyseBaseUrl) {
      set({ error: "Analyse base URL not configured" });
      return null;
    }

    set({ isRunning: true, error: null, judgeResult: null });

    try {
      const payload = {
        traceId,
        dimensions: options?.dimensions,
        judgeModel: options?.judgeModel,
        mode: options?.mode,
      };

      const streamResponse = await fetch(`${config.analyseBaseUrl}/analyses/judge?stream=true`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!streamResponse.ok) {
        let message = "Failed to run LLM judge";
        try {
          const raw = await streamResponse.text();
          if (raw) {
            const parsed = JSON.parse(raw) as { error?: string; message?: string };
            message = parsed.error || parsed.message || message;
          }
        } catch {
          // Ignore parse errors and use default message.
        }
        throw new Error(message);
      }

      if (!streamResponse.body) {
        throw new Error("Streaming response body missing");
      }

      let finalResult: JudgeResult | null = null;
      await parseNdjsonStream(streamResponse.body, (chunk) => {
        if (!chunk.success) {
          const message = chunk.error || "Failed to run LLM judge";
          set({ error: message });
          return;
        }

        if (!chunk.analysis) return;

        const status = chunk.analysis.status;
        if (status === "completed") {
          finalResult = chunk.analysis;
        }

        set({
          judgeResult: chunk.analysis,
          isRunning: status !== "completed" && status !== "failed",
          error: null,
        });
      });

      set({ isRunning: false });
      return finalResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to run LLM judge";
      set({ error: message, isRunning: false });
      return null;
    }
  },

  fetchPastAnalyses: async (traceId: string) => {
    const config = useConfigStore.getState().config;
    const apiKey = useTraceDetailStore.getState().apiKey;

    if (!config?.analyseBaseUrl) {
      set({ error: "Analyse base URL not configured" });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await apiClient.get<{ success: boolean; analyses: PastAnalysis[] }>(
        `${config.analyseBaseUrl}/analyses/trace/${traceId}`,
        {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        }
      );

      set({ pastAnalyses: response.data.analyses, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch past analyses";
      set({ error: message, isLoading: false });
    }
  },

  fetchAnalysisDetail: async (id: string) => {
    const config = useConfigStore.getState().config;
    const apiKey = useTraceDetailStore.getState().apiKey;

    if (!config?.analyseBaseUrl) {
      set({ error: "Analyse base URL not configured" });
      return null;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await apiClient.get<{ success: boolean; analysis: JudgeResult }>(
        `${config.analyseBaseUrl}/analyses/${id}`,
        {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        }
      );

      const result = response.data.analysis;
      set({ judgeResult: result, isLoading: false });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch analysis";
      set({ error: message, isLoading: false });
      return null;
    }
  },

  reset: () =>
    set({
      judgeResult: null,
      pastAnalyses: [],
      isRunning: false,
      isLoading: false,
      error: null,
    }),
}));
