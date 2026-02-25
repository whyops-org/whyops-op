import { create } from "zustand";
import { persist } from "zustand/middleware";

import { apiClient } from "@/lib/api-client";
import { useConfigStore } from "./configStore";

export interface TraceEvent {
  id: string;
  stepId: number;
  parentStepId?: number;
  spanId?: string;
  eventType: string;
  timestamp: string;
  content: TraceEventContent;
  metadata?: TraceEventMetadata | null;
  duration?: number;
  timeSinceStart?: number;
  isLateEvent?: boolean;
}

export interface TraceEventMetadata {
  tool?: string;
  totalRecords?: number;
  model?: string;
  provider?: string;
  providerSlug?: string;
  usage?: {
    totalTokens?: number;
    promptTokens?: number;
    completionTokens?: number;
  };
  latencyMs?: number;
  [key: string]: unknown;
}

export type TraceEventContent = unknown;

export interface TraceCostRate {
  id: string;
  model: string;
  inputTokenPricePerMillionToken: number;
  outputTokenPricePerMillionToken: number;
  cachedTokenPricePerMillionToken: number;
  createdAt: string;
  updatedAt: string;
}

export interface TraceDetail {
  threadId: string;
  userId: string;
  providerId?: string;
  entityId?: string;
  entityName?: string;
  model?: string;
  systemPrompt?: string;
  tools?: unknown[];
  firstEventTimestamp: string;
  lastEventTimestamp: string;
  duration: number;
  eventCount: number;
  totalTokens: number;
  totalLatency: number;
  avgLatency: number;
  errorCount: number;
  events: TraceEvent[];
  hasLateEvents: boolean;
  cost?: TraceCostRate[];
}

interface TraceDetailState {
  trace: TraceDetail | null;
  isLoading: boolean;
  error: string | null;
  apiKey: string | null;

  setApiKey: (key: string) => void;
  fetchTrace: (traceId: string) => Promise<TraceDetail | null>;
}

export const useTraceDetailStore = create<TraceDetailState>()(
  persist(
    (set, get) => ({
      trace: null,
      isLoading: false,
      error: null,
      apiKey: null,

      setApiKey: (key: string) => set({ apiKey: key }),

      fetchTrace: async (traceId: string) => {
        const config = useConfigStore.getState().config;
        const { apiKey } = get();

        if (!config?.analyseBaseUrl) {
          set({ error: "Analyse base URL not configured" });
          return null;
        }

        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.get<TraceDetail>(
            `${config.analyseBaseUrl}/threads/${traceId}?include=systemPrompt,tools,metadata,content&eventInclude=metadata,content`,
            {
              headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
            }
          );

          const data = response.data;

          // Transform dates to ISO strings
          const trace: TraceDetail = {
            ...data,
            firstEventTimestamp: new Date(data.firstEventTimestamp).toISOString(),
            lastEventTimestamp: new Date(data.lastEventTimestamp).toISOString(),
            events: data.events.map((e) => ({
              ...e,
              timestamp: new Date(e.timestamp).toISOString(),
            })),
          };

          set({ trace, isLoading: false });
          return trace;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to fetch trace";
          set({ error: message, isLoading: false });
          return null;
        }
      },
    }),
    {
      name: "whyops-trace-store",
      partialize: (state) => ({ apiKey: state.apiKey }),
    }
  )
);
