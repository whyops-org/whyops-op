import { create } from "zustand";
import { persist } from "zustand/middleware";

import { apiClient } from "@/lib/api-client";
import { useConfigStore } from "./configStore";
import type { Agent, AgentsResponse, Pagination, SingleAgentResponse } from "@/types/global";

interface AgentsState {
  agents: Agent[];
  currentAgent: Agent | null;
  isLoading: boolean;
  isRefetching: boolean;
  error: string | null;
  pollingInterval: NodeJS.Timeout | null;
  apiKey: string | null;
  pagination: Pagination;

  setApiKey: (key: string) => void;
  setInitialAgents: (agents: Agent[]) => void;
  fetchAgents: (page?: number, count?: number) => Promise<void>;
  fetchAgentById: (agentId: string, successRatePeriod?: number, isRefetch?: boolean) => Promise<Agent | null>;
  startPolling: (intervalMs: number) => void;
  stopPolling: () => void;
}

export const useAgentsStore = create<AgentsState>()(
  persist(
    (set, get) => ({
      agents: [],
      currentAgent: null,
      isLoading: false,
      isRefetching: false,
      error: null,
      pollingInterval: null,
      apiKey: null,
      pagination: {
        total: 0,
        count: 20,
        page: 1,
        totalPages: 1,
        hasMore: false,
      },

      setApiKey: (key: string) => set({ apiKey: key }),

      setInitialAgents: (agents: Agent[], paginationData?: Pagination) => set({
        agents,
        pagination: paginationData || get().pagination
      }),

      fetchAgents: async (page = 1, count = 20) => {
        const config = useConfigStore.getState().config;
        const { apiKey } = get();

        if (!config?.analyseBaseUrl) {
          set({ error: "Analyse base URL not configured" });
          return;
        }

        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.get<AgentsResponse>(
            `${config.analyseBaseUrl}/entities`,
            {
              headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
              params: { page, count },
            }
          );
          set({
            agents: response.data.agents || [],
            pagination: response.data.pagination || get().pagination,
            isLoading: false
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to fetch agents";
          set({ error: message, isLoading: false });
        }
      },

      fetchAgentById: async (agentId: string, successRatePeriod = 7, isRefetch = false) => {
        const config = useConfigStore.getState().config;
        const { apiKey } = get();

        if (!config?.analyseBaseUrl) {
          set({ error: "Analyse base URL not configured" });
          return null;
        }

        set(isRefetch ? { isRefetching: true, error: null } : { isLoading: true, error: null });

        try {
          const response = await apiClient.get<SingleAgentResponse>(
            `${config.analyseBaseUrl}/entities/${agentId}`,
            {
              headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
              params: { successRatePeriod },
            }
          );
          set({ currentAgent: response.data, isLoading: false, isRefetching: false });
          return response.data;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to fetch agent";
          set({ error: message, isLoading: false, isRefetching: false });
          return null;
        }
      },

      startPolling: (intervalMs: number) => {
        const { pollingInterval, fetchAgents, pagination } = get();

        if (pollingInterval) {
          clearInterval(pollingInterval);
        }

        fetchAgents(pagination.page, pagination.count);

        const interval = setInterval(() => {
          fetchAgents(pagination.page, pagination.count);
        }, intervalMs);

        set({ pollingInterval: interval });
      },

      stopPolling: () => {
        const { pollingInterval } = get();
        if (pollingInterval) {
          clearInterval(pollingInterval);
          set({ pollingInterval: null });
        }
      },
    }),
    {
      name: "whyops-agents-store",
      partialize: (state) => ({ apiKey: state.apiKey }),
    }
  )
);
