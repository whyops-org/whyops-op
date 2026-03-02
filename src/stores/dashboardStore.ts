import { create } from "zustand";
import { persist } from "zustand/middleware";

import { DEFAULT_AGENT_USAGE_COUNT } from "@/constants/dashboard";
import { apiClient } from "@/lib/api-client";
import { useConfigStore } from "./configStore";

export interface DashboardStats {
  totalAgents: number;
  activeTraces: number;
  successRate: number;
  avgLatency: string;
  successRateDelta?: number | null;
  avgLatencyDeltaMs?: number | null;
}

export interface ChartDataPoint {
  day: string;
  value: number;
}

export interface AgentUsageData {
  [agentName: string]: number;
}

interface DashboardState {
  stats: DashboardStats | null;
  chartData: ChartDataPoint[];
  agentUsage: AgentUsageData;
  agentUsageCount: number;
  isLoading: boolean;
  error: string | null;
  apiKey: string | null;

  setApiKey: (key: string) => void;
  setAgentUsageCount: (count: number) => void;
  fetchDashboardStats: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      stats: null,
      chartData: [],
      agentUsage: {},
      agentUsageCount: DEFAULT_AGENT_USAGE_COUNT,
      isLoading: false,
      error: null,
      apiKey: null,

      setApiKey: (key: string) => set({ apiKey: key }),
      setAgentUsageCount: (count: number) => set({ agentUsageCount: count }),

      fetchDashboardStats: async () => {
        const config = useConfigStore.getState().config;
        const { apiKey, agentUsageCount } = get();

        if (!config?.analyseBaseUrl) {
          set({ error: "Analyse base URL not configured" });
          return;
        }

        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.get<{
            totalAgents: number;
            activeTraces: number;
            successRate: number;
            avgLatency: string;
            successRateDelta?: number | null;
            avgLatencyDeltaMs?: number | null;
            timeline: ChartDataPoint[];
            agentUsage?: AgentUsageData;
            agentsUsage?: AgentUsageData;
          }>(`${config.analyseBaseUrl}/analytics/dashboard`, {
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
            params: {
              agentCount: agentUsageCount,
            },
          });

          const data = response.data;
          const rawUsage = data.agentUsage ?? data.agentsUsage ?? {};
          const normalizedUsage = Object.entries(rawUsage).reduce<AgentUsageData>(
            (acc, [agentName, value]) => {
              const numericValue = typeof value === "number" ? value : Number(value);
              if (Number.isFinite(numericValue)) {
                acc[agentName] = numericValue;
              }
              return acc;
            },
            {}
          );

          set({
            stats: {
              totalAgents: data.totalAgents,
              activeTraces: data.activeTraces,
              successRate: data.successRate,
              avgLatency: data.avgLatency,
              successRateDelta: data.successRateDelta ?? null,
              avgLatencyDeltaMs: data.avgLatencyDeltaMs ?? null,
            },
            chartData: data.timeline || [],
            agentUsage: normalizedUsage,
            isLoading: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to fetch dashboard stats";
          set({ error: message, isLoading: false });
        }
      },
    }),
    {
      name: "whyops-dashboard-store",
      partialize: (state) => ({ apiKey: state.apiKey }),
    }
  )
);
