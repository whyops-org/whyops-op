import { create } from "zustand";
import { persist } from "zustand/middleware";

import { DEFAULT_TIMELINE_PERIOD } from "@/constants/agent-timelines";
import { apiClient } from "@/lib/api-client";
import { useConfigStore } from "./configStore";
import type { Agent, AgentsResponse, Pagination, SingleAgentResponse } from "@/types/global";

interface UpdateSamplingRateResponse {
  success: boolean;
  agentId: string;
  samplingRate: number;
  updatedVersions: number;
  latestVersionId: string;
  updatedAt: string;
}

interface DeleteAgentResponse {
  success: boolean;
  agentId: string;
}

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
  fetchAgents: (page?: number, count?: number, isRefetch?: boolean) => Promise<void>;
  fetchAgentById: (
    agentId: string,
    successRatePeriod?: number,
    traceCountPeriod?: number,
    isRefetch?: boolean,
    externalUserId?: string | null
  ) => Promise<Agent | null>;
  updateAgentSamplingRate: (agentId: string, samplingRate: number) => Promise<number | null>;
  deleteAgent: (agentId: string) => Promise<boolean>;
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

      fetchAgents: async (page = 1, count = 20, isRefetch = false) => {
        const config = useConfigStore.getState().config;
        const { apiKey } = get();

        if (!config?.analyseBaseUrl) {
          set({ error: "Analyse base URL not configured" });
          return;
        }

        const shouldRefetch = isRefetch || get().agents.length > 0;
        set(
          shouldRefetch
            ? { isRefetching: true, error: null }
            : { isLoading: true, isRefetching: false, error: null }
        );

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
            isLoading: false,
            isRefetching: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to fetch agents";
          set({ error: message, isLoading: false, isRefetching: false });
        }
      },

      fetchAgentById: async (
        agentId: string,
        successRatePeriod = DEFAULT_TIMELINE_PERIOD,
        traceCountPeriod = DEFAULT_TIMELINE_PERIOD,
        isRefetch = false,
        externalUserId = null
      ) => {
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
              params: {
                successRatePeriod,
                traceCountPeriod,
                ...(externalUserId ? { externalUserId } : {}),
              },
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

      updateAgentSamplingRate: async (agentId: string, samplingRate: number) => {
        const config = useConfigStore.getState().config;
        const { apiKey } = get();

        if (!config?.analyseBaseUrl) {
          set({ error: "Analyse base URL not configured" });
          return null;
        }

        try {
          const response = await apiClient.patch<UpdateSamplingRateResponse>(
            `${config.analyseBaseUrl}/entities/${agentId}/sampling-rate`,
            { samplingRate },
            {
              headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
            }
          );

          const nextRate = Number(response.data.samplingRate);
          const nextUpdatedAt = response.data.updatedAt;
          const nextLatestVersionId = response.data.latestVersionId;

          set((state) => ({
            agents: state.agents.map((agent) =>
              agent.id === agentId
                ? {
                    ...agent,
                    latestVersion: agent.latestVersion
                      ? {
                          ...agent.latestVersion,
                          samplingRate: nextRate,
                          updatedAt: nextUpdatedAt,
                        }
                      : agent.latestVersion,
                  }
                : agent
            ),
            currentAgent:
              state.currentAgent && state.currentAgent.id === agentId
                ? {
                    ...state.currentAgent,
                    latestVersion: state.currentAgent.latestVersion
                      ? {
                          ...state.currentAgent.latestVersion,
                          samplingRate: nextRate,
                          updatedAt: nextUpdatedAt,
                        }
                      : state.currentAgent.latestVersion,
                    versions: state.currentAgent.versions?.map((version) => ({
                      ...version,
                      samplingRate: nextRate,
                      updatedAt: version.id === nextLatestVersionId ? nextUpdatedAt : version.updatedAt,
                    })),
                  }
                : state.currentAgent,
          }));

          return nextRate;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to update sampling rate";
          set({ error: message });
          return null;
        }
      },

      deleteAgent: async (agentId: string) => {
        const config = useConfigStore.getState().config;
        const { apiKey } = get();

        if (!config?.analyseBaseUrl) {
          set({ error: "Analyse base URL not configured" });
          return false;
        }

        try {
          await apiClient.delete<DeleteAgentResponse>(
            `${config.analyseBaseUrl}/entities/${agentId}`,
            {
              headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
            }
          );

          set((state) => ({
            agents: state.agents.filter((agent) => agent.id !== agentId),
            currentAgent:
              state.currentAgent && state.currentAgent.id === agentId
                ? null
                : state.currentAgent,
            pagination: {
              ...state.pagination,
              total: Math.max(0, state.pagination.total - 1),
            },
          }));

          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to delete agent";
          set({ error: message });
          return false;
        }
      },

      startPolling: (intervalMs: number) => {
        const { pollingInterval, fetchAgents, pagination } = get();

        if (pollingInterval) {
          clearInterval(pollingInterval);
        }

        void fetchAgents(pagination.page, pagination.count);

        const interval = setInterval(() => {
          void fetchAgents(pagination.page, pagination.count, true);
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
