import { create } from "zustand";
import { persist } from "zustand/middleware";

import { apiClient } from "@/lib/api-client";
import { useConfigStore } from "./configStore";

export interface UserDistributionItem {
  externalUserId: string;
  traceCount: number;
  totalTokens: number;
  totalCost: number;
  errorCount: number;
  lastActiveAt: string | null;
}

export interface UserDistributionTotals {
  totalTraces: number;
  totalCost: number;
  totalTokens: number;
  totalErrors: number;
  uniqueUsers: number;
}

export interface Pagination {
  total: number;
  count: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export interface UserDistributionResponse {
  success: boolean;
  users: UserDistributionItem[];
  totals: UserDistributionTotals;
  pagination: Pagination;
}

interface UserDistributionState {
  users: UserDistributionItem[];
  totals: UserDistributionTotals | null;
  pagination: Pagination;
  isLoading: boolean;
  error: string | null;

  fetchUserDistribution: (agentId: string, page?: number, count?: number) => Promise<void>;
}

export const useUserDistributionStore = create<UserDistributionState>()(
  persist(
    (set) => ({
      users: [],
      totals: null,
      pagination: {
        total: 0,
        count: 20,
        page: 1,
        totalPages: 0,
        hasMore: false,
      },
      isLoading: false,
      error: null,

      fetchUserDistribution: async (agentId: string, page = 1, count = 20) => {
        const config = useConfigStore.getState().config;

        if (!config?.analyseBaseUrl) {
          set({ error: "Analyse base URL not configured" });
          return;
        }

        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.get<UserDistributionResponse>(
            `${config.analyseBaseUrl}/entities/${agentId}/user-distribution`,
            {
              headers: {},
              params: { page, count },
            }
          );

          if (response.data.success) {
            set({
              users: response.data.users,
              totals: response.data.totals,
              pagination: response.data.pagination,
              isLoading: false,
            });
          } else {
            set({ error: "Failed to fetch user distribution", isLoading: false });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to fetch user distribution";
          set({ error: message, isLoading: false });
        }
      },
    }),
    {
      name: "whyops-user-distribution-store",
      partialize: () => ({}),
    }
  )
);
