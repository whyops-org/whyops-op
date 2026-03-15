import { create } from "zustand";

import type { EvalCategory } from "@/constants/agent-evals";
import { apiClient } from "@/lib/api-client";
import type { Pagination } from "@/types/global";
import { useAgentsStore } from "./agentsStore";
import { useConfigStore } from "./configStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface EvalConversationTurn {
  role: "user" | "assistant" | "system";
  content: string;
  expected_tool_calls?: Array<{ name: string; arguments?: Record<string, unknown> }>;
  expected_behavior?: string;
}

export interface EvalCase {
  id: string;
  runId: string;
  agentId: string;
  category: EvalCategory;
  subcategory: string | null;
  title: string;
  description: string | null;
  conversation: EvalConversationTurn[];
  expectedOutcome: {
    tools_called?: string[];
    key_assertions?: string[];
    refusal_expected?: boolean;
    quality_criteria?: string[];
  };
  scoringRubric: {
    dimensions?: Array<{ name: string; weight: number; criteria: string }>;
  };
  difficulty: "basic" | "intermediate" | "advanced";
  toolsTested: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface EvalRunSummary {
  categoryCounts?: Record<string, number>;
  totalGenerated?: number;
  domain?: string;
  pipelineStats?: {
    candidatesGenerated: number;
    afterValidation: number;
    afterDedup: number;
    critiqueRoundsRun: number;
    finalCount: number;
  };
  toolsCoverage?: {
    covered: string[];
    uncovered: string[];
    coveragePercent: number;
  };
}

export interface EvalRun {
  id: string;
  configId: string | null;
  agentId: string;
  entityId: string | null;
  status: "pending" | "running" | "completed" | "failed";
  trigger: "manual" | "scheduled" | "entity_change";
  customPrompt: string | null;
  evalCount: number;
  summary: EvalRunSummary;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  cases?: EvalCase[];
}

export interface EvalConfigRecord {
  id: string;
  agentId: string;
  enabled: boolean;
  cronExpr: string;
  timezone: string;
  categories: EvalCategory[];
  maxEvalsPerRun: number;
  customPrompt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeProfile {
  domain: string;
  domainDescription: string;
  subDomains: string[];
  competitors: Array<{
    name: string;
    description: string;
    strengths: string[];
    weaknesses: string[];
  }>;
  failureModes: Array<{
    code: string;
    description: string;
    severity: string;
    examples: string[];
    mitigations: string[];
  }>;
  bestPractices: Array<{ area: string; practice: string; rationale: string }>;
  userExpectations: Array<{ expectation: string; priority: string }>;
  edgeCasePatterns: string[];
  safetyConsiderations: string[];
}

export interface EvalCheckpoint {
  stage: string;
  detail: string;
  progress?: number;
}

interface EvalStreamChunk {
  success: boolean;
  status?: "intelligence_building";
  message?: string;
  checkpoint?: EvalCheckpoint;
  result?: {
    runId: string;
    status: string;
    evalCount: number;
    categoryCounts: Record<string, number>;
    summary: EvalRunSummary;
  };
  error?: string;
}

// ---------------------------------------------------------------------------
// NDJSON stream parser
// ---------------------------------------------------------------------------
async function parseNdjsonStream(
  stream: ReadableStream<Uint8Array>,
  onChunk: (chunk: EvalStreamChunk) => void
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
      const parsed = JSON.parse(trimmed) as EvalStreamChunk;
      onChunk(parsed);
    }
  }

  const tail = buffer.trim();
  if (tail) {
    onChunk(JSON.parse(tail) as EvalStreamChunk);
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
interface AgentEvalsState {
  currentRun: EvalRun | null;
  configRecord: EvalConfigRecord | null;
  knowledgeProfile: KnowledgeProfile | null;
  runs: EvalRun[];
  pagination: Pagination;
  currentCheckpoint: EvalCheckpoint | null;
  isRunning: boolean;
  isIntelligenceBuilding: boolean;
  isLoading: boolean;
  isHistoryLoading: boolean;
  isConfigLoading: boolean;
  isConfigSaving: boolean;
  isKnowledgeLoading: boolean;
  isExporting: boolean;
  error: string | null;

  generateEvals: (
    agentId: string,
    options?: {
      categories?: EvalCategory[];
      maxEvalsPerRun?: number;
      customPrompt?: string;
      judgeModel?: string;
    }
  ) => Promise<EvalRun | null>;
  fetchLatestRun: (agentId: string) => Promise<EvalRun | null>;
  fetchRuns: (agentId: string, page?: number, count?: number) => Promise<void>;
  fetchRunById: (agentId: string, runId: string) => Promise<EvalRun | null>;
  fetchConfig: (agentId: string) => Promise<EvalConfigRecord | null>;
  saveConfig: (
    agentId: string,
    payload: {
      enabled: boolean;
      cronExpr: string;
      timezone: string;
      categories?: EvalCategory[];
      maxEvalsPerRun?: number;
      customPrompt?: string;
    }
  ) => Promise<EvalConfigRecord | null>;
  fetchKnowledgeProfile: (agentId: string) => Promise<void>;
  rebuildKnowledge: (agentId: string) => Promise<void>;
  exportJson: (agentId: string, runId?: string) => Promise<void>;
  exportPromptfoo: (agentId: string, runId?: string) => Promise<void>;
  reset: () => void;
}

function getApiContext() {
  const config = useConfigStore.getState().config;
  const apiKey = useAgentsStore.getState().apiKey;
  return { config, apiKey };
}

function authHeaders(apiKey: string | null | undefined): Record<string, string> {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

export const useAgentEvalsStore = create<AgentEvalsState>()((set, get) => ({
  currentRun: null,
  configRecord: null,
  knowledgeProfile: null,
  runs: [],
  pagination: { total: 0, count: 20, page: 1, totalPages: 1, hasMore: false },
  currentCheckpoint: null,
  isRunning: false,
  isIntelligenceBuilding: false,
  isLoading: false,
  isHistoryLoading: false,
  isConfigLoading: false,
  isConfigSaving: false,
  isKnowledgeLoading: false,
  isExporting: false,
  error: null,

  generateEvals: async (agentId, options) => {
    const { config, apiKey } = getApiContext();
    if (!config?.analyseBaseUrl) {
      set({ error: "Analyse base URL not configured" });
      return null;
    }

    set({ isRunning: true, error: null, currentCheckpoint: null, isIntelligenceBuilding: false });

    try {
      const response = await fetch(
        `${config.analyseBaseUrl}/evals/${agentId}/generate?stream=true`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/x-ndjson",
            ...authHeaders(apiKey),
          },
          credentials: "include",
          body: JSON.stringify({
            categories: options?.categories,
            maxEvalsPerRun: options?.maxEvalsPerRun,
            customPrompt: options?.customPrompt,
            judgeModel: options?.judgeModel,
          }),
        }
      );

      if (!response.ok) {
        let message = "Failed to generate evals";
        try {
          const raw = await response.text();
          if (raw) {
            const parsed = JSON.parse(raw) as { error?: string };
            message = parsed.error || message;
          }
        } catch { /* keep default */ }
        throw new Error(message);
      }

      if (!response.body) throw new Error("Streaming response body missing");

      let generatedRunId: string | null = null;

      await parseNdjsonStream(response.body, (chunk) => {
        if (!chunk.success) {
          set({ error: chunk.error || "Failed to generate evals", isRunning: false });
          return;
        }

        // Intelligence building — stream ends after this single message
        if (chunk.status === "intelligence_building") {
          set({
            isIntelligenceBuilding: true,
            isRunning: false,
            currentCheckpoint: {
              stage: "intelligence_building",
              detail: chunk.message || "Building intelligence in background...",
            },
          });
          return;
        }

        // Checkpoint update during generation
        if (chunk.checkpoint) {
          set({ currentCheckpoint: chunk.checkpoint });
        }

        // Final result from pipeline
        if (chunk.result) {
          generatedRunId = chunk.result.runId;
        }
      });

      // After stream ends: if we got a run ID, fetch the full run with cases
      if (generatedRunId) {
        const fullRun = await get().fetchRunById(agentId, generatedRunId);
        set({ isRunning: false, currentCheckpoint: null });
        return fullRun;
      }

      set({ isRunning: false });
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate evals";
      set({ error: message, isRunning: false });
      return null;
    }
  },

  fetchLatestRun: async (agentId) => {
    const { config, apiKey } = getApiContext();
    if (!config?.analyseBaseUrl) { set({ error: "Analyse base URL not configured" }); return null; }

    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.get<{ success: boolean; run: EvalRun }>(
        `${config.analyseBaseUrl}/evals/${agentId}/latest`,
        { headers: authHeaders(apiKey) }
      );
      const run = response.data.run;
      set({ currentRun: run, isLoading: false });
      return run;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to fetch latest eval run";
      if (msg.toLowerCase().includes("no eval run found")) {
        set({ currentRun: null, isLoading: false, error: null });
        return null;
      }
      set({ error: msg, isLoading: false });
      return null;
    }
  },

  fetchRuns: async (agentId, page = 1, count = 20) => {
    const { config, apiKey } = getApiContext();
    if (!config?.analyseBaseUrl) { set({ error: "Analyse base URL not configured" }); return; }

    set({ isHistoryLoading: true, error: null });
    try {
      const response = await apiClient.get<{
        success: boolean; runs: EvalRun[]; total: number; page: number; pageSize: number;
      }>(`${config.analyseBaseUrl}/evals/${agentId}/runs`, {
        headers: authHeaders(apiKey),
        params: { page, count },
      });
      const total = response.data.total || 0;
      set({
        runs: response.data.runs || [],
        pagination: {
          total,
          count,
          page,
          totalPages: Math.ceil(total / count),
          hasMore: page * count < total,
        },
        isHistoryLoading: false,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to fetch eval runs", isHistoryLoading: false });
    }
  },

  fetchRunById: async (agentId, runId) => {
    const { config, apiKey } = getApiContext();
    if (!config?.analyseBaseUrl) { set({ error: "Analyse base URL not configured" }); return null; }

    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.get<{ success: boolean; run: EvalRun }>(
        `${config.analyseBaseUrl}/evals/${agentId}/runs/${runId}`,
        { headers: authHeaders(apiKey) }
      );
      const run = response.data.run;
      // Only update currentRun, do NOT modify runs array (preserves history order)
      set({ currentRun: run, isLoading: false });
      return run;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to fetch eval run", isLoading: false });
      return null;
    }
  },

  fetchConfig: async (agentId) => {
    const { config, apiKey } = getApiContext();
    if (!config?.analyseBaseUrl) { set({ error: "Analyse base URL not configured" }); return null; }

    set({ isConfigLoading: true, error: null });
    try {
      const response = await apiClient.get<{ success: boolean; config: EvalConfigRecord | null }>(
        `${config.analyseBaseUrl}/evals/${agentId}/config`,
        { headers: authHeaders(apiKey) }
      );
      set({ configRecord: response.data.config || null, isConfigLoading: false });
      return response.data.config || null;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to fetch eval config", isConfigLoading: false });
      return null;
    }
  },

  saveConfig: async (agentId, payload) => {
    const { config, apiKey } = getApiContext();
    if (!config?.analyseBaseUrl) { set({ error: "Analyse base URL not configured" }); return null; }

    set({ isConfigSaving: true, error: null });
    try {
      const response = await apiClient.put<{ success: boolean; config: EvalConfigRecord }>(
        `${config.analyseBaseUrl}/evals/${agentId}/config`,
        payload,
        { headers: authHeaders(apiKey) }
      );
      set({ configRecord: response.data.config, isConfigSaving: false });
      return response.data.config;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to save eval config", isConfigSaving: false });
      return null;
    }
  },

  fetchKnowledgeProfile: async (agentId) => {
    const { config, apiKey } = getApiContext();
    if (!config?.analyseBaseUrl) return;

    set({ isKnowledgeLoading: true });
    try {
      const response = await apiClient.get<{ success: boolean; profile: KnowledgeProfile | null }>(
        `${config.analyseBaseUrl}/evals/${agentId}/knowledge-profile`,
        { headers: authHeaders(apiKey) }
      );
      // The API returns the full DB row; the actual profile data is in .profile field
      const raw = response.data.profile as Record<string, unknown> | null;
      const profile = raw
        ? ((raw as Record<string, unknown>).profile as KnowledgeProfile | undefined) || (raw as unknown as KnowledgeProfile)
        : null;
      set({ knowledgeProfile: profile, isKnowledgeLoading: false });
    } catch {
      set({ isKnowledgeLoading: false });
    }
  },

  rebuildKnowledge: async (agentId) => {
    const { config, apiKey } = getApiContext();
    if (!config?.analyseBaseUrl) return;

    set({ isKnowledgeLoading: true });
    try {
      await apiClient.post(`${config.analyseBaseUrl}/evals/${agentId}/knowledge-profile/rebuild`, null, {
        headers: authHeaders(apiKey),
      });
      await get().fetchKnowledgeProfile(agentId);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to rebuild knowledge", isKnowledgeLoading: false });
    }
  },

  exportJson: async (agentId, runId) => {
    const { config, apiKey } = getApiContext();
    if (!config?.analyseBaseUrl) return;

    set({ isExporting: true });
    try {
      const url = `${config.analyseBaseUrl}/evals/${agentId}/export/json${runId ? `?runId=${runId}` : ""}`;
      const response = await apiClient.get<{ success: boolean; evals: unknown[]; count: number }>(url, {
        headers: authHeaders(apiKey),
      });
      const blob = new Blob([JSON.stringify(response.data.evals, null, 2)], { type: "application/json" });
      downloadBlob(blob, `evals-${agentId}.json`);
      set({ isExporting: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Export failed", isExporting: false });
    }
  },

  exportPromptfoo: async (agentId, runId) => {
    const { config, apiKey } = getApiContext();
    if (!config?.analyseBaseUrl) return;

    set({ isExporting: true });
    try {
      const url = `${config.analyseBaseUrl}/evals/${agentId}/export/promptfoo${runId ? `?runId=${runId}` : ""}`;
      const response = await fetch(url, {
        headers: authHeaders(apiKey),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Export failed");
      const text = await response.text();
      const blob = new Blob([text], { type: "text/yaml" });
      downloadBlob(blob, `evals-${agentId}.yaml`);
      set({ isExporting: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Export failed", isExporting: false });
    }
  },

  reset: () =>
    set({
      currentRun: null,
      configRecord: null,
      knowledgeProfile: null,
      runs: [],
      pagination: { total: 0, count: 20, page: 1, totalPages: 1, hasMore: false },
      currentCheckpoint: null,
      isRunning: false,
      isIntelligenceBuilding: false,
      isLoading: false,
      isHistoryLoading: false,
      isConfigLoading: false,
      isConfigSaving: false,
      isKnowledgeLoading: false,
      isExporting: false,
      error: null,
    }),
}));

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
