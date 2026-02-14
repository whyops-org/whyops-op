import { create } from "zustand";

import { apiClient } from "@/lib/api-client";

export type ProviderType = "openai" | "anthropic";

export interface ProviderTypeConfig {
  type: ProviderType;
  name: string;
  detail: string;
  defaultBaseUrl: string;
  models: string[];
}

export interface EnvironmentConfig {
  name: string;
  displayName: string;
  description: string;
}

export interface SdkLanguage {
  id: string;
  label: string;
  icon: string;
  installCommand: string;
}

export interface OnboardingStep {
  id: string;
  label: string;
  order: number;
}

export interface OnboardingChecklistItem {
  id: string;
  text: string;
  icon: string;
}

export interface SdkConfig {
  decorator: string;
  initFunction: string;
  initParams: Record<string, string>;
}

export interface AppConfig {
  authBaseUrl: string;
  proxyBaseUrl: string;
  analyseBaseUrl: string;
  // Legacy alias
  apiBaseUrl: string;
  providerTypes: ProviderTypeConfig[];
  environments: EnvironmentConfig[];
  sdkLanguages: SdkLanguage[];
  onboardingSteps: OnboardingStep[];
  onboardingChecklist: OnboardingChecklistItem[];
  sdkConfig: Record<string, SdkConfig>;
}

interface ConfigState {
  config: AppConfig | null;
  isLoading: boolean;
  error: string | null;

  fetchConfig: () => Promise<void>;
  getProviderType: (type: ProviderType) => ProviderTypeConfig | undefined;
  getEnvironment: (name: string) => EnvironmentConfig | undefined;
  getDefaultBaseUrl: (type: ProviderType) => string;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  isLoading: false,
  error: null,

  fetchConfig: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.get<AppConfig>("/api/config");
      set({ config: response.data, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch config";
      set({ error: message, isLoading: false });
    }
  },

  getProviderType: (type: ProviderType) => {
    const { config } = get();
    return config?.providerTypes.find((p) => p.type === type);
  },

  getEnvironment: (name: string) => {
    const { config } = get();
    return config?.environments.find((e) => e.name === name);
  },

  getDefaultBaseUrl: (type: ProviderType) => {
    const providerType = get().getProviderType(type);
    return providerType?.defaultBaseUrl || "";
  },
}));
