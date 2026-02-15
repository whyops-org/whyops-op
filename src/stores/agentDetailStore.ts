import { create } from "zustand";
import { persist } from "zustand/middleware";

import { apiClient } from "@/lib/api-client";
import { useConfigStore } from "./configStore";

export interface Thread {
  threadId: string;
  userId: string;
  providerId?: string;
  entityId?: string;
  entityName?: string;
  lastActivity: string;
  eventCount: number;
  duration?: number;
}

export interface AgentStats {
  totalTraces: number;
  successRate: number;
  avgDuration: string;
  errorsToday: number;
}

interface AgentDetailState {
  threads: Thread[];
  stats: AgentStats | null;
  isLoading: boolean;
  error: string | null;
  apiKey: string | null;

  setApiKey: (key: string) => void;
  fetchAgentDetail: (agentId: string) => Promise<void>;
}

export const useAgentDetailStore = create<AgentDetailState>()(
  persist(
    (set, get) => ({
      threads: [],
      stats: null,
      isLoading: false,
      error: null,
      apiKey: null,

      setApiKey: (key: string) => set({ apiKey: key }),

      fetchAgentDetail: async (agentId: string) => {
        const config = useConfigStore.getState().config;
        const { apiKey } = get();

        if (!config?.analyseBaseUrl) {
          set({ error: "Analyse base URL not configured" });
          return;
        }

        set({ isLoading: true, error: null });

        const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};

        try {
          // Fetch entity details
          const entityResponse = await apiClient.get<{
            id: string;
            name: string;
            metadata: Record<string, unknown>;
          }>(`${config.analyseBaseUrl}/entities/${agentId}`, { headers });

          // Fetch threads
          const threadsResponse = await apiClient.get<{ threads: Thread[] }>(
            `${config.analyseBaseUrl}/threads`,
            { headers }
          );

          const threads: Thread[] = (threadsResponse.data.threads || [])
            .filter((t) => t.entityId === agentId)
            .map((t) => ({
              ...t,
              lastActivity: new Date(t.lastActivity).toISOString(),
            }));

          // Calculate stats from threads
          const totalTraces = threads.length;
          const errorCount = threads.filter((t) => t.eventCount === 0).length;
          const successRate = totalTraces > 0
            ? Math.round(((totalTraces - errorCount) / totalTraces) * 1000) / 10
            : 100;

          // Calculate avg duration
          const durations = threads.filter((t) => t.duration).map((t) => t.duration!);
          const avgDurationMs = durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length
            : 0;
          const avgDuration = avgDurationMs > 1000
            ? `${(avgDurationMs / 1000).toFixed(1)}s`
            : `${Math.round(avgDurationMs)}ms`;

          set({
            threads,
            stats: {
              totalTraces,
              successRate,
              avgDuration,
              errorsToday: errorCount,
            },
            isLoading: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to fetch agent details";
          set({ error: message, isLoading: false });
        }
      },
    }),
    {
      name: "whyops-agent-detail-store",
      partialize: (state) => ({ apiKey: state.apiKey }),
    }
  )
);
