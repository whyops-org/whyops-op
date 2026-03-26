import { create } from "zustand";

import type { AgentAnalysisDimension, AgentAnalysisMode } from "@/constants/agent-analysis";
import { apiClient } from "@/lib/api-client";
import type { Pagination } from "@/types/global";
import { useAgentsStore } from "./agentsStore";
import { useConfigStore } from "./configStore";

export interface AgentAnalysisCheckpoint {
  key: string;
  sequence: number;
  at: string;
  data?: Record<string, unknown>;
}

export interface AgentAnalysisSummary {
  analysisVersion?: string;
  mode?: AgentAnalysisMode;
  lookbackDays?: number;
  dimensions?: AgentAnalysisDimension[];
  dimensionCount?: number;
  sectionCount?: number;
  overallScore?: number;
  findingCount?: number;
  bySeverity?: Record<string, number>;
  failedDimensions?: Record<string, string>;
  note?: string;
  dataCoverage?: {
    totalUserEvents?: number;
    processedUserEvents?: number;
    userEventsTruncated?: boolean;
  };
  checkpoint?: AgentAnalysisCheckpoint;
  [key: string]: unknown;
}

export interface AgentAnalysisOverviewSection {
  totalTraces: number;
  totalEvents: number;
  activeDays: number;
  multiTurnRate: number;
  errorRate: number;
  avgLatencyMs: number | null;
  p50LatencyMs: number | null;
  p90LatencyMs: number | null;
  totalTokens: number;
  avgTokensPerResponse: number | null;
  toolCallRate: number;
}

export interface AgentAnalysisQueryIntelligenceSection {
  topInitialQueries: Array<{ query: string; count: number }>;
  topRepeatedQueries: Array<{ query: string; count: number }>;
  topHighErrorQueries: Array<{ query: string; traceCount: number; errorRate: number }>;
  topHighLatencyQueries: Array<{ query: string; traceCount: number; avgLatencyMs: number }>;
  firstQueryIntentCategories?: Record<string, number>;
  topFirstQueryIntents?: Array<{
    intent: string;
    count: number;
    share: number;
  }>;
  firstQueryIntentOutcomes?: Array<{
    intent: string;
    traceCount: number;
    share: number;
    errorRate: number;
    followupRate: number;
    toolUsageRate: number;
    likelyResolvedRate: number;
    expectedToolMissRate: number;
    arbitraryToolCallRate: number;
  }>;
  topIntentsNeedingDevelopment?: Array<{
    intent: string;
    traceCount: number;
    developmentNeedScore: number;
    likelyResolvedRate: number;
    expectedToolMissRate: number;
    reasons: string[];
  }>;
  llmInsights?: {
    headline: string;
    keyThemes: string[];
    frictionPoints: string[];
    opportunities: string[];
    actionHints: string[];
  };
  inputCoverage?: {
    totalUserEvents: number;
    processedUserEvents: number;
    truncated: boolean;
  };
}

export interface AgentAnalysisFollowupIntelligenceSection {
  topFollowups: Array<{ query: string; count: number }>;
  followupRate: number;
  followupCount?: number;
  avgTurnsPerTrace?: number;
  loopingTraces?: number;
  intentCategories: Record<string, number>;
  llmInsights?: {
    headline: string;
    whyUsersFollowUp: string[];
    unresolvedPatterns: string[];
    repairOpportunities: string[];
    actionHints: string[];
  };
}

export interface AgentAnalysisIntentIntelligenceSection {
  topIntentClusters: Array<{ clusterKey: string; sampleQuery: string; count: number }>;
  intentDistribution: Record<string, number>;
  intentShiftVsPreviousRun: Record<string, number>;
}

export interface AgentAnalysisToolIntelligenceSection {
  tools: Array<{
    toolName: string;
    calls: number;
    likelyErrors: number;
    likelySuccessRate: number;
    retries: number;
    avgLatencyMs: number | null;
    avgResponseBytes: number;
  }>;
  bestPerformingTools: Array<{
    toolName: string;
    calls: number;
    likelySuccessRate: number;
    retries: number;
  }>;
  expensiveTools: Array<{
    toolName: string;
    calls: number;
    avgLatencyMs: number | null;
    avgResponseBytes: number;
  }>;
  routingSignals?: {
    likelyToolNeededTraces: number;
    likelyToolNeededWithoutToolTraces: number;
    toolNeedMissRate: number;
    topToolNeedWithoutToolQueries: Array<{ query: string; count: number }>;
  };
  routingAssessment?: {
    expectedToolTraces: number;
    expectedAndCalled: number;
    expectedButMissed: number;
    calledWithoutNeed: number;
    routingRecall: number;
    routingPrecision: number;
    arbitraryCallRate: number;
  };
  effectiveness?: {
    topResolvedTools: Array<{
      toolName: string;
      traces: number;
      likelyResolvedRate: number;
      errorRate: number;
      followupRate: number;
      arbitraryCallRate: number;
    }>;
    underperformingTools: Array<{
      toolName: string;
      traces: number;
      likelyResolvedRate: number;
      errorRate: number;
      followupRate: number;
      arbitraryCallRate: number;
    }>;
    mostUsedTools: Array<{
      toolName: string;
      traces: number;
      likelyResolvedRate: number;
      errorRate: number;
      followupRate: number;
      arbitraryCallRate: number;
    }>;
  };
  utilization?: {
    totalToolResponses: number;
    consumedToolResponses: number;
    utilizationRate: number;
  };
}

export interface AgentAnalysisQualityIntelligenceSection {
  analyzedTraceCount: number;
  sampled?: boolean;
  sampleLimit?: number;
  dimensionAverages: Record<string, number | null>;
  dimensionTrendVsPreviousRun: Record<string, number | null>;
  severityDistribution: Record<string, number>;
  llmInsights?: {
    headline: string;
    rootCauses: string[];
    reliabilityRisks: string[];
    costLatencyDrivers: string[];
    actionHints: string[];
  };
  reliability?: {
    tracesWithError: number;
    recoveredTraces: number;
    recoveryRate: number;
  };
}

export interface AgentAnalysisDimensionScoresSection {
  overallScore: number;
  scoresByDimension: Record<string, number>;
  trendVsPreviousRun: Record<string, number | null>;
  dimensions: Array<{
    dimension: AgentAnalysisDimension;
    score: number;
    severity: "low" | "medium" | "high" | "critical";
    confidence: number;
    summary: string;
    issueCount: number;
    strengths: string[];
    weaknesses: string[];
  }>;
  totalIssues: number;
  bySeverity: Record<string, number>;
  failures?: Record<string, string>;
}

export interface AgentAnalysisDimensionDeepDiveSection {
  dimensions: Record<
    string,
    {
      dimension: AgentAnalysisDimension;
      score: number;
      severity: "low" | "medium" | "high" | "critical";
      confidence: number;
      summary: string;
      strengths: string[];
      weaknesses: string[];
      issues: Array<{
        code: string;
        title: string;
        detail: string;
        severity: "low" | "medium" | "high" | "critical";
        confidence: number;
        frequency: number;
        impactScore: number;
        evidence: Array<{
          traceId: string | null;
          signalType: string;
          snippet: string;
        }>;
        rootCause: string;
        recommendation: {
          action: string;
          detail: string;
          ownerType: string;
          fixType: string;
        };
        patches: Array<Record<string, unknown>>;
      }>;
    }
  >;
}

export interface AgentAnalysisFailureTaxonomySection {
  patterns: Array<{
    code: string;
    title: string;
    dimension: AgentAnalysisDimension;
    severity: "low" | "medium" | "high" | "critical";
    count: number;
    impactScore: number;
    summary: string;
    recommendedFixTypes: string[];
  }>;
  totalFindings: number;
  bySeverity: Record<string, number>;
}

export interface AgentAnalysisToolDiagnosticsSection {
  tools: Array<{
    toolName: string;
    riskSummary: string;
    keyIssues: string[];
  }>;
  systemicIssues: Array<{
    title: string;
    detail: string;
    severity: "low" | "medium" | "high" | "critical";
    relatedTools: string[];
  }>;
  routingAnomalies: Array<{
    title: string;
    detail: string;
    severity: "low" | "medium" | "high" | "critical";
    evidence: string[];
  }>;
}

export interface AgentAnalysisActionPlanSection {
  items: Array<{
    priority: number;
    title: string;
    why: string;
    ownerType: string;
    fixType: string;
    dimensions: AgentAnalysisDimension[];
    steps: string[];
    metric: string;
    expectedImpact: string;
    severity: "low" | "medium" | "high" | "critical";
  }>;
}

export interface AgentAnalysisExperimentsSection {
  items: Array<{
    name: string;
    hypothesis: string;
    change: string;
    metric: string;
    successCriteria: string;
    risk: "low" | "medium" | "high";
    effort: "S" | "M" | "L";
  }>;
}

export interface AgentAnalysisFinding {
  id?: string;
  runId?: string;
  dimension: string;
  code: string;
  title: string;
  detail: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  frequency: number;
  impactScore: number;
  evidence: Array<{
    traceId: string | null;
    signalType: string;
    snippet: string;
  }>;
  rootCause: string | null;
  recommendation: {
    action: string;
    detail: string;
    ownerType: string;
    fixType: string;
  };
  patches: Array<Record<string, unknown>>;
}

export interface AgentAnalysisConfigRecord {
  id: string;
  agentId: string;
  enabled: boolean;
  cronExpr: string;
  timezone: string;
  lookbackDays: number;
  samplingConfig: {
    mode?: AgentAnalysisMode;
    judgeModel?: string | null;
    dimensions?: AgentAnalysisDimension[];
    [key: string]: unknown;
  };
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentAnalysisRecommendationsSection {
  items: Array<{
    priority: number;
    title: string;
    detail: string;
    category: string;
    severity: "low" | "medium" | "high" | "critical";
  }>;
}

export interface AgentAnalysisSections {
  overview?: AgentAnalysisOverviewSection;
  query_intelligence?: AgentAnalysisQueryIntelligenceSection;
  followup_intelligence?: AgentAnalysisFollowupIntelligenceSection;
  intent_intelligence?: AgentAnalysisIntentIntelligenceSection;
  tool_intelligence?: AgentAnalysisToolIntelligenceSection;
  quality_intelligence?: AgentAnalysisQualityIntelligenceSection;
  dimension_scores?: AgentAnalysisDimensionScoresSection;
  dimension_deep_dive?: AgentAnalysisDimensionDeepDiveSection;
  failure_taxonomy?: AgentAnalysisFailureTaxonomySection;
  tool_diagnostics?: AgentAnalysisToolDiagnosticsSection;
  action_plan?: AgentAnalysisActionPlanSection;
  experiments?: AgentAnalysisExperimentsSection;
  recommendations?: AgentAnalysisRecommendationsSection;
  [key: string]: unknown;
}

export interface AgentAnalysisRun {
  id: string;
  configId: string | null;
  agentId: string;
  status: "pending" | "running" | "completed" | "failed";
  traceCount: number;
  eventCount: number;
  windowStart: string;
  windowEnd: string;
  summary: AgentAnalysisSummary;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sections?: AgentAnalysisSections;
  findings?: AgentAnalysisFinding[];
}

export interface RunAgentAnalysisOptions {
  mode?: AgentAnalysisMode;
  lookbackDays?: number;
  judgeModel?: string;
  dimensions?: AgentAnalysisDimension[];
}

interface AgentAnalysisRunStreamChunk {
  success: boolean;
  run?: AgentAnalysisRun;
  error?: string;
}

async function parseNdjsonStream(
  stream: ReadableStream<Uint8Array>,
  onChunk: (chunk: AgentAnalysisRunStreamChunk) => void
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
      const parsed = JSON.parse(trimmed) as AgentAnalysisRunStreamChunk;
      onChunk(parsed);
    }
  }

  const tail = buffer.trim();
  if (tail) {
    const parsed = JSON.parse(tail) as AgentAnalysisRunStreamChunk;
    onChunk(parsed);
  }
}

function mergeRunIntoHistory(runs: AgentAnalysisRun[], run: AgentAnalysisRun): AgentAnalysisRun[] {
  const deduped = runs.filter((existing) => existing.id !== run.id);
  return [run, ...deduped];
}

interface AgentAnalysisState {
  currentRun: AgentAnalysisRun | null;
  configRecord: AgentAnalysisConfigRecord | null;
  runs: AgentAnalysisRun[];
  pagination: Pagination;
  isRunning: boolean;
  isLoading: boolean;
  isHistoryLoading: boolean;
  isConfigLoading: boolean;
  isConfigSaving: boolean;
  error: string | null;

  runAnalysis: (agentId: string, options?: RunAgentAnalysisOptions) => Promise<AgentAnalysisRun | null>;
  fetchConfig: (agentId: string) => Promise<AgentAnalysisConfigRecord | null>;
  saveConfig: (
    agentId: string,
    payload: {
      enabled: boolean;
      cronExpr: string;
      timezone: string;
      lookbackDays: number;
      mode?: AgentAnalysisMode;
      judgeModel?: string;
      dimensions?: AgentAnalysisDimension[];
    }
  ) => Promise<AgentAnalysisConfigRecord | null>;
  fetchLatestRun: (agentId: string) => Promise<AgentAnalysisRun | null>;
  fetchRuns: (agentId: string, page?: number, count?: number) => Promise<void>;
  fetchRunById: (runId: string) => Promise<AgentAnalysisRun | null>;
  reset: () => void;
}

export const useAgentAnalysisStore = create<AgentAnalysisState>()((set, get) => ({
  currentRun: null,
  configRecord: null,
  runs: [],
  pagination: {
    total: 0,
    count: 20,
    page: 1,
    totalPages: 1,
    hasMore: false,
  },
  isRunning: false,
  isLoading: false,
  isHistoryLoading: false,
  isConfigLoading: false,
  isConfigSaving: false,
  error: null,

  runAnalysis: async (agentId: string, options?: RunAgentAnalysisOptions) => {
    const config = useConfigStore.getState().config;
    const apiKey = useAgentsStore.getState().apiKey;

    if (!config?.analyseBaseUrl) {
      set({ error: "Analyse base URL not configured" });
      return null;
    }

    set({ isRunning: true, error: null, currentRun: null });

    try {
      const response = await fetch(
        `${config.analyseBaseUrl}/agent-analyses/${agentId}/run?stream=true`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/x-ndjson",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          credentials: "include",
          body: JSON.stringify({
            mode: options?.mode,
            lookbackDays: options?.lookbackDays,
            judgeModel: options?.judgeModel,
            dimensions: options?.dimensions,
          }),
        }
      );

      if (!response.ok) {
        let message = "Failed to run agent analysis";
        try {
          const raw = await response.text();
          if (raw) {
            const parsed = JSON.parse(raw) as { error?: string; message?: string };
            message = parsed.error || parsed.message || message;
          }
        } catch {
          // Ignore parse errors and keep default message.
        }
        throw new Error(message);
      }

      if (!response.body) {
        throw new Error("Streaming response body missing");
      }

      let finalResult: AgentAnalysisRun | null = null;
      await parseNdjsonStream(response.body, (chunk) => {
        if (!chunk.success) {
          set({ error: chunk.error || "Failed to run agent analysis", isRunning: false });
          return;
        }

        if (!chunk.run) return;

        const status = chunk.run.status;
        if (status === "completed") {
          finalResult = chunk.run;
        }

        set({
          currentRun: chunk.run,
          runs: status === "completed" ? mergeRunIntoHistory(get().runs, chunk.run) : get().runs,
          isRunning: status !== "completed" && status !== "failed",
          error: null,
        });
      });

      set({ isRunning: false });
      return finalResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to run agent analysis";
      set({ error: message, isRunning: false });
      return null;
    }
  },

  fetchConfig: async (agentId: string) => {
    const config = useConfigStore.getState().config;
    const apiKey = useAgentsStore.getState().apiKey;

    if (!config?.analyseBaseUrl) {
      set({ error: "Analyse base URL not configured" });
      return null;
    }

    set({ isConfigLoading: true, error: null });

    try {
      const response = await apiClient.get<{
        success: boolean;
        config: AgentAnalysisConfigRecord | null;
      }>(`${config.analyseBaseUrl}/agent-analyses/${agentId}/config`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });

      set({
        configRecord: response.data.config || null,
        isConfigLoading: false,
      });

      return response.data.config || null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch analysis config";
      set({ error: message, isConfigLoading: false });
      return null;
    }
  },

  saveConfig: async (agentId: string, payload) => {
    const config = useConfigStore.getState().config;
    const apiKey = useAgentsStore.getState().apiKey;

    if (!config?.analyseBaseUrl) {
      set({ error: "Analyse base URL not configured" });
      return null;
    }

    set({ isConfigSaving: true, error: null });

    try {
      const response = await apiClient.put<{
        success: boolean;
        config: AgentAnalysisConfigRecord;
      }>(`${config.analyseBaseUrl}/agent-analyses/${agentId}/config`, payload, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });

      set({
        configRecord: response.data.config,
        isConfigSaving: false,
      });

      return response.data.config;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save analysis config";
      set({ error: message, isConfigSaving: false });
      return null;
    }
  },

  fetchLatestRun: async (agentId: string) => {
    const config = useConfigStore.getState().config;
    const apiKey = useAgentsStore.getState().apiKey;

    if (!config?.analyseBaseUrl) {
      set({ error: "Analyse base URL not configured" });
      return null;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await apiClient.get<{ success: boolean; run: AgentAnalysisRun }>(
        `${config.analyseBaseUrl}/agent-analyses/${agentId}/latest`,
        {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        }
      );

      set({
        currentRun: response.data.run,
        runs: mergeRunIntoHistory(get().runs, response.data.run),
        isLoading: false,
      });
      return response.data.run;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch latest analysis run";
      if (message.toLowerCase().includes("no analysis run found")) {
        set({ currentRun: null, isLoading: false, error: null });
        return null;
      }
      set({ error: message, isLoading: false });
      return null;
    }
  },

  fetchRuns: async (agentId: string, page = 1, count = 20) => {
    const config = useConfigStore.getState().config;
    const apiKey = useAgentsStore.getState().apiKey;

    if (!config?.analyseBaseUrl) {
      set({ error: "Analyse base URL not configured" });
      return;
    }

    set({ isHistoryLoading: true, error: null });

    try {
      const response = await apiClient.get<{
        success: boolean;
        runs: AgentAnalysisRun[];
        pagination: Pagination;
      }>(`${config.analyseBaseUrl}/agent-analyses/${agentId}/runs`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        params: { page, count },
      });

      set({
        runs: response.data.runs || [],
        pagination: response.data.pagination || get().pagination,
        isHistoryLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch analysis runs";
      set({ error: message, isHistoryLoading: false });
    }
  },

  fetchRunById: async (runId: string) => {
    const config = useConfigStore.getState().config;
    const apiKey = useAgentsStore.getState().apiKey;

    if (!config?.analyseBaseUrl) {
      set({ error: "Analyse base URL not configured" });
      return null;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await apiClient.get<{ success: boolean; run: AgentAnalysisRun }>(
        `${config.analyseBaseUrl}/agent-analyses/runs/${runId}`,
        {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        }
      );

      set({
        currentRun: response.data.run,
        runs: mergeRunIntoHistory(get().runs, response.data.run),
        isLoading: false,
      });
      return response.data.run;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch analysis run";
      set({ error: message, isLoading: false });
      return null;
    }
  },

  reset: () =>
    set({
      currentRun: null,
      configRecord: null,
      runs: [],
      pagination: {
        total: 0,
        count: 20,
        page: 1,
        totalPages: 1,
        hasMore: false,
      },
      isRunning: false,
      isLoading: false,
      isHistoryLoading: false,
      isConfigLoading: false,
      isConfigSaving: false,
      error: null,
    }),
}));
