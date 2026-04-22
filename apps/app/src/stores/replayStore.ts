import { create } from "zustand";
import { useConfigStore } from "./configStore";
import { useTraceDetailStore } from "./traceDetailStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReplayVariantConfig {
  systemPrompt?: string;
  toolDescriptions?: Record<string, string>;
  patchSummary?: string;
}

export interface ReplayComparison {
  originalStepCount: number;
  replayStepCount: number;
  originalErrorCount: number;
  replayErrorCount: number;
  originalToolCallCount: number;
  replayToolCallCount: number;
  loopResolved: boolean;
  finalAnswerChanged: boolean;
  score: number;
  summary: string;
}

export interface ReplayEvent {
  stepId: number;
  eventType: string;
  content: unknown;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface ReplayRun {
  id: string;
  traceId: string;
  analysisId?: string;
  status: "pending" | "running" | "completed" | "failed";
  variantConfig: ReplayVariantConfig;
  replayEvents?: ReplayEvent[];
  comparison?: ReplayComparison;
  score?: number;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}

export interface RunReplayOptions {
  analysisId?: string;
  variantConfig: ReplayVariantConfig;
  judgeModel?: string;
}

interface StreamChunk {
  success: boolean;
  run?: ReplayRun;
  error?: string;
  checkpoint?: string;
  status?: string;
}

async function consumeNdjsonStream(
  stream: ReadableStream<Uint8Array>,
  onChunk: (chunk: StreamChunk) => void
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      try { onChunk(JSON.parse(t)); } catch {}
    }
  }
  if (buf.trim()) {
    try { onChunk(JSON.parse(buf.trim())); } catch {}
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface ReplayState {
  currentRun: ReplayRun | null;
  pastRuns: ReplayRun[];
  isRunning: boolean;
  isLoading: boolean;
  error: string | null;

  runReplay: (traceId: string, options: RunReplayOptions) => Promise<ReplayRun | null>;
  fetchPastRuns: (traceId: string) => Promise<void>;
  fetchRunDetail: (runId: string) => Promise<ReplayRun | null>;
  setCurrentRun: (run: ReplayRun | null) => void;
  reset: () => void;
}

export const useReplayStore = create<ReplayState>()((set) => ({
  currentRun: null,
  pastRuns: [],
  isRunning: false,
  isLoading: false,
  error: null,

  runReplay: async (traceId, options) => {
    const config = useConfigStore.getState().config;
    const apiKey = useTraceDetailStore.getState().apiKey;
    if (!config?.analyseBaseUrl) {
      set({ error: "Analyse base URL not configured" });
      return null;
    }

    set({ isRunning: true, error: null, currentRun: null });

    try {
      const res = await fetch(
        `${config.analyseBaseUrl}/trace-replay/${encodeURIComponent(traceId)}/run?stream=true`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/x-ndjson",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          credentials: "include",
          body: JSON.stringify({
            analysisId: options.analysisId,
            judgeModel: options.judgeModel,
            variantConfig: options.variantConfig,
          }),
        }
      );

      if (!res.ok) {
        const msg = await res.text().catch(() => "Failed to start replay");
        throw new Error(msg);
      }

      if (!res.body) throw new Error("No stream body");

      let finalRun: ReplayRun | null = null;
      await consumeNdjsonStream(res.body, (chunk) => {
        if (!chunk.success) {
          set({ error: chunk.error ?? "Replay failed" });
          return;
        }
        if (!chunk.run) return;
        const status = chunk.run.status;
        if (status === "completed" || status === "failed") finalRun = chunk.run;
        set({
          currentRun: chunk.run,
          isRunning: status !== "completed" && status !== "failed",
        });
      });

      set({ isRunning: false });
      if (finalRun) {
        set((s) => ({
          pastRuns: [finalRun!, ...s.pastRuns.filter((r) => r.id !== finalRun!.id)],
        }));
      }
      return finalRun;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Replay failed";
      set({ error: msg, isRunning: false });
      return null;
    }
  },

  fetchPastRuns: async (traceId) => {
    const config = useConfigStore.getState().config;
    const apiKey = useTraceDetailStore.getState().apiKey;
    if (!config?.analyseBaseUrl) return;

    set({ isLoading: true, error: null });
    try {
      const res = await fetch(
        `${config.analyseBaseUrl}/trace-replay/${encodeURIComponent(traceId)}/runs`,
        {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
          credentials: "include",
        }
      );
      const data = await res.json();
      set({ pastRuns: data?.runs ?? [], isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchRunDetail: async (runId) => {
    const config = useConfigStore.getState().config;
    const apiKey = useTraceDetailStore.getState().apiKey;
    if (!config?.analyseBaseUrl) return null;

    set({ isLoading: true, error: null });
    try {
      const res = await fetch(
        `${config.analyseBaseUrl}/trace-replay/runs/${encodeURIComponent(runId)}`,
        {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
          credentials: "include",
        }
      );
      const data = await res.json();
      const run = data?.run ?? null;
      if (run) set({ currentRun: run });
      set({ isLoading: false });
      return run;
    } catch {
      set({ isLoading: false });
      return null;
    }
  },

  setCurrentRun: (run) => set({ currentRun: run }),

  reset: () => set({ currentRun: null, pastRuns: [], isRunning: false, isLoading: false, error: null }),
}));
