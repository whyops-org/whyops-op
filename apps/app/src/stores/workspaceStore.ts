import { create } from "zustand";

import { apiRequest } from "@/lib/api-client";

export interface Environment {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface MasterKey {
  id: string;
  name: string;
  keyPrefix: string;
  key: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  environments?: Environment[];
}

export interface CreateProjectResponse {
  project: Project;
  environments: Environment[];
  masterKeys: MasterKey[];
  warning: string;
}

export interface WorkspaceState {
  projects: Project[];
  currentProject: Project | null;
  masterKeys: MasterKey[] | null;
  isLoading: boolean;
  error: string | null;

  fetchProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<CreateProjectResponse>;
  clearMasterKeys: () => void;
  clearError: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  projects: [],
  currentProject: null,
  masterKeys: null,
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiRequest<{ projects: Project[] }>("/api/projects", {
        method: "GET",
      });
      set({ projects: response.projects, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch projects";
      set({ error: message, isLoading: false });
    }
  },

  createProject: async (name: string, description?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiRequest<CreateProjectResponse>("/api/projects", {
        method: "POST",
        body: { name, description },
      });
      set((state) => ({
        projects: [...state.projects, response.project],
        currentProject: response.project,
        masterKeys: response.masterKeys,
        isLoading: false,
      }));
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create project";
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  clearMasterKeys: () => set({ masterKeys: null }),

  clearError: () => set({ error: null }),
}));
