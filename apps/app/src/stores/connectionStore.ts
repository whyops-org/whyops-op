import { create } from "zustand";
import { persist } from "zustand/middleware";

import { apiClient } from "@/lib/api-client";
import { useConfigStore } from "./configStore";

export interface ConnectionStep {
  id: string;
  label: string;
  description: string;
  status: "success" | "loading" | "pending" | "error";
  timestamp?: string;
}

export interface ConnectionLog {
  time: string;
  message: string;
  status?: "success" | "error" | "connected";
}

interface ConnectionState {
  isConnected: boolean;
  isTesting: boolean;
  steps: ConnectionStep[];
  logs: ConnectionLog[];
  error: string | null;
  apiKey: string | null;

  setApiKey: (key: string) => void;
  testConnection: () => Promise<void>;
  reset: () => void;
}

const initialSteps: ConnectionStep[] = [
  {
    id: "verify-key",
    label: "Verify API Key Integrity",
    description: "Validating API key...",
    status: "pending",
  },
  {
    id: "ping-endpoint",
    label: "Ping Ingestion Endpoint",
    description: "Testing connection to API...",
    status: "pending",
  },
  {
    id: "wait-trace",
    label: "Waiting for Trace Event",
    description: "Listening for incoming data streams...",
    status: "pending",
  },
];

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set, get) => ({
      isConnected: false,
      isTesting: false,
      steps: [...initialSteps],
      logs: [],
      error: null,
      apiKey: null,

      setApiKey: (key: string) => set({ apiKey: key }),

      reset: () => set({
        isConnected: false,
        isTesting: false,
        steps: [...initialSteps],
        logs: [],
        error: null,
      }),

      testConnection: async () => {
        const config = useConfigStore.getState().config;
        const { apiKey } = get();

        if (!config?.analyseBaseUrl) {
          set({ error: "Analyse base URL not configured" });
          return;
        }

        set({
          isTesting: true,
          error: null,
          steps: [...initialSteps],
          logs: [],
        });

        const addLog = (message: string, status?: ConnectionLog["status"]) => {
          const time = new Date().toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          set((state) => ({
            logs: [...state.logs, { time, message, status }],
          }));
        };

        const updateStep = (stepId: string, updates: Partial<ConnectionStep>) => {
          set((state) => ({
            steps: state.steps.map((s) =>
              s.id === stepId ? { ...s, ...updates } : s
            ),
          }));
        };

        try {
          // Step 1: Verify API Key
          updateStep("verify-key", { status: "loading", description: "Validating API key..." });
          addLog("Verifying API key integrity...");

          // Try to fetch entities to verify the API key
          await apiClient.get(`${config.analyseBaseUrl}/entities`, {
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
          });

          // Get last 4 chars of API key for display
          const keySuffix = apiKey ? apiKey.slice(-4) : "xxxx";
          updateStep("verify-key", {
            status: "success",
            description: `Validated key ending in ...${keySuffix}`,
          });
          addLog(`API key verified (ending in ...${keySuffix})`, "success");

          // Step 2: Ping Endpoint
          updateStep("ping-endpoint", { status: "loading", description: "Testing connection to API..." });
          addLog("Pinging Ingestion Endpoint...");

          const startTime = Date.now();
          await apiClient.get(`${config.analyseBaseUrl}/health`, {
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
          });
          const latency = Date.now() - startTime;

          updateStep("ping-endpoint", {
            status: "success",
            description: `Latency: ${latency}ms`,
          });
          addLog(`Connection established (${latency}ms)`, "connected");

          // Step 3: Wait for Trace Events
          updateStep("wait-trace", { status: "loading", description: "Listening for incoming data streams..." });
          addLog("Listening for incoming trace events...");

          // Poll for events for a short period
          const maxAttempts = 10;
          const pollInterval = 2000;
          let foundEvents = false;

          for (let i = 0; i < maxAttempts; i++) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval));

            try {
              const response = await apiClient.get<{ events?: unknown[] }>(
                `${config.analyseBaseUrl}/events`,
                {
                  headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
                }
              );

              const events = response.data.events || [];
              if (events.length > 0) {
                foundEvents = true;
                updateStep("wait-trace", {
                  status: "success",
                  description: `Received ${events.length} event(s)`,
                });
                addLog(`Received ${events.length} trace event(s)`, "success");
                break;
              }
            } catch {
              // Continue polling even if events endpoint returns error
            }
          }

          if (!foundEvents) {
            updateStep("wait-trace", {
              status: "success",
              description: "No events yet - agent may not be running",
            });
            addLog("No trace events received yet", "error");
          }

          set({ isConnected: true, isTesting: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Connection failed";
          set({ error: message, isTesting: false });

          // Mark current step as error
          const currentStep = get().steps.find((s) => s.status === "loading");
          if (currentStep) {
            updateStep(currentStep.id, { status: "error", description: message });
          }

          addLog(`Error: ${message}`, "error");
        }
      },
    }),
    {
      name: "whyops-connection-store",
      partialize: (state) => ({ apiKey: state.apiKey }),
    }
  )
);
