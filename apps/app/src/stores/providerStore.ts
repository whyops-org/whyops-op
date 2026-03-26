import { create } from "zustand";

import { apiClient } from "@/lib/api-client";

export type ProviderType = "openai" | "anthropic";

export interface Provider {
  id: string;
  name: string;
  slug: string;
  type: ProviderType;
  baseUrl: string;
  apiKey?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderInput {
  name: string;
  slug: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface ProviderState {
  providers: Provider[];
  selectedProvider: Provider | null;
  isLoading: boolean;
  error: string | null;
  testStatus: "idle" | "testing" | "success" | "error";
  testError: string | null;

  fetchProviders: () => Promise<void>;
  createProvider: (data: ProviderInput) => Promise<Provider>;
  updateProvider: (id: string, data: Partial<ProviderInput>) => Promise<Provider>;
  deleteProvider: (id: string) => Promise<void>;
  toggleProvider: (id: string) => Promise<void>;
  testConnection: (data: ProviderInput) => Promise<boolean>;
  setSelectedProvider: (provider: Provider | null) => void;
  clearError: () => void;
}

const DEFAULT_BASE_URLS: Record<ProviderType, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
};

export const useProviderStore = create<ProviderState>((set) => ({
  providers: [],
  selectedProvider: null,
  isLoading: false,
  error: null,
  testStatus: "idle",
  testError: null,

  fetchProviders: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.get<{ providers: Provider[] }>("/api/providers");
      set({ providers: response.data.providers, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch providers";
      set({ error: message, isLoading: false });
    }
  },

  createProvider: async (data: ProviderInput) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post<Provider>("/api/providers", data);
      set((state) => ({
        providers: [...state.providers, response.data],
        isLoading: false,
      }));
      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create provider";
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  updateProvider: async (id: string, data: Partial<ProviderInput>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.put<Provider>(`/api/providers/${id}`, data);
      set((state) => ({
        providers: state.providers.map((p) => (p.id === id ? response.data : p)),
        isLoading: false,
      }));
      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update provider";
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  deleteProvider: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.delete(`/api/providers/${id}`);
      set((state) => ({
        providers: state.providers.filter((p) => p.id !== id),
        isLoading: false,
        selectedProvider: state.selectedProvider?.id === id ? null : state.selectedProvider,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete provider";
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  toggleProvider: async (id: string) => {
    try {
      const response = await apiClient.patch<Provider>(`/api/providers/${id}/toggle`);
      set((state) => ({
        providers: state.providers.map((p) => (p.id === id ? response.data : p)),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to toggle provider";
      set({ error: message });
      throw error;
    }
  },

  testConnection: async (data: ProviderInput) => {
    set({ testStatus: "testing", testError: null });
    try {
      const response = await apiClient.post<{ success: boolean; message: string }>(
        "/api/providers/test",
        data
      );
      if (response.data.success) {
        set({ testStatus: "success" });
        return true;
      } else {
        set({ testStatus: "error", testError: response.data.message });
        return false;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection test failed";
      set({ testStatus: "error", testError: message });
      return false;
    }
  },

  setSelectedProvider: (provider) => set({ selectedProvider: provider }),

  clearError: () => set({ error: null, testStatus: "idle", testError: null }),
}));

export { DEFAULT_BASE_URLS };
