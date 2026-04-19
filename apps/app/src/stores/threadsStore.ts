import { create } from "zustand";
import { persist } from "zustand/middleware";

import { apiClient } from "@/lib/api-client";
import { useConfigStore } from "./configStore";

export interface Thread {
  threadId: string;
  userId: string;
  externalUserId?: string | null;
  providerId?: string | null;
  agentId?: string | null;
  entityId?: string | null;
  entityName?: string | null;
  model?: string | null;
  systemPrompt?: string;
  tools?: string[];
  metadata?: Record<string, unknown>;
  lastActivity: string;
  lastEventTimestamp?: string;
  eventCount: number;
  duration?: number;
  firstEventTimestamp?: string;
}

export interface Pagination {
  total: number;
  count: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

interface ThreadsState {
  threads: Thread[];
  pagination: Pagination;
  isLoading: boolean;
  isRefetching: boolean;
  error: string | null;
  apiKey: string | null;
  externalUserIdFilter: string | null;

  setApiKey: (key: string) => void;
  setExternalUserIdFilter: (externalUserId: string | null) => void;
  fetchThreads: (agentId?: string, page?: number, count?: number, isRefetch?: boolean) => Promise<void>;
}

export const useThreadsStore = create<ThreadsState>()(
  persist(
    (set, get) => ({
      threads: [],
      pagination: {
        total: 0,
        count: 20,
        page: 1,
        totalPages: 1,
        hasMore: false,
      },
      isLoading: false,
      isRefetching: false,
      error: null,
      apiKey: null,
      externalUserIdFilter: null,

      setApiKey: (key: string) => set({ apiKey: key }),
      setExternalUserIdFilter: (externalUserId: string | null) => set({ externalUserIdFilter: externalUserId }),

      fetchThreads: async (agentId?: string, page = 1, count = 20, isRefetch = false) => {
        const config = useConfigStore.getState().config;
        const { apiKey, externalUserIdFilter } = get();

        if (!config?.analyseBaseUrl) {
          set({ error: "Analyse base URL not configured" });
          return;
        }

        if (isRefetch) {
          set({ isRefetching: true, error: null });
        } else {
          set({ isLoading: true, error: null });
        }

        try {
          const params: Record<string, unknown> = { page, count };
          if (agentId) {
            params.agentId = agentId;
          }
          if (externalUserIdFilter) {
            params.externalUserId = externalUserIdFilter;
          }

          const response = await apiClient.get<{ threads: Thread[]; pagination: Pagination }>(
            `${config.analyseBaseUrl}/threads`,
            {
              headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
              params,
            }
          );

          const threads: Thread[] = (response.data.threads || []).map((t) => ({
            threadId: t.threadId,
            userId: t.userId,
            externalUserId: t.externalUserId,
            providerId: t.providerId,
            agentId: t.agentId,
            entityId: t.entityId,
            entityName: t.entityName,
            model: t.model,
            systemPrompt: t.systemPrompt,
            tools: t.tools,
            metadata: t.metadata,
            lastActivity: new Date(t.lastActivity).toISOString(),
            lastEventTimestamp: t.lastEventTimestamp ? new Date(t.lastEventTimestamp).toISOString() : undefined,
            eventCount: t.eventCount,
            duration: t.duration,
            firstEventTimestamp: t.firstEventTimestamp ? new Date(t.firstEventTimestamp).toISOString() : undefined,
          }));

          set({
            threads,
            pagination: response.data.pagination || get().pagination,
            isLoading: false,
            isRefetching: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to fetch threads";
          set({ error: message, isLoading: false, isRefetching: false });
        }
      },
    }),
    {
      name: "whyops-threads-store",
      partialize: (state) => ({ apiKey: state.apiKey }),
    }
  )
);
