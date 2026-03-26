import { create } from "zustand";

import { apiClient } from "@/lib/api-client";
import { useConfigStore } from "./configStore";

export interface Event {
  id: string;
  eventType: string;
  traceId: string;
  agentName: string;
  content: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

interface EventsState {
  events: Event[];
  isLoading: boolean;
  error: string | null;
  pollingInterval: NodeJS.Timeout | null;

  fetchEvents: () => Promise<void>;
  startPolling: (intervalMs: number) => void;
  stopPolling: () => void;
}

export const useEventsStore = create<EventsState>((set, get) => ({
  events: [],
  isLoading: false,
  error: null,
  pollingInterval: null,

  fetchEvents: async () => {
    const config = useConfigStore.getState().config;
    if (!config?.analyseBaseUrl) {
      set({ error: "Analyse base URL not configured" });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await apiClient.get<{ events: Event[] }>(
        `${config.analyseBaseUrl}/events`
      );
      set({ events: response.data.events || [], isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch events";
      set({ error: message, isLoading: false });
    }
  },

  startPolling: (intervalMs: number) => {
    const { pollingInterval, fetchEvents } = get();

    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    fetchEvents();

    const interval = setInterval(() => {
      fetchEvents();
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
}));
