import { create } from "zustand";
import { apiClient } from "@/lib/api-client";

export interface Environment {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface MasterKey {
  id: string;
  key: string;
  name: string;
  prefix: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

// Backend returns different field names
interface BackendMasterKey {
  keyId: string;
  apiKey: string;
  environmentName: string;
  keyPrefix: string;
}

export interface ProjectInput {
  name: string;
  description?: string;
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  currentEnvironments: Environment[];
  masterKeys: MasterKey[];
  currentApiKey: string | null;
  isLoading: boolean;
  error: string | null;

  fetchProjects: () => Promise<void>;
  createProject: (data: ProjectInput) => Promise<{ masterKeys: MasterKey[] }>;
  setCurrentApiKey: (key: string) => void;
  clearMasterKeys: () => void;
  clearError: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  currentEnvironments: [],
  masterKeys: [],
  currentApiKey: null,
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.get<{ projects: Project[] }>("/api/projects");
      set({ projects: response.data.projects, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch projects";
      set({ error: message, isLoading: false });
    }
  },

  createProject: async (data: ProjectInput) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post<{
        project: Project;
        environments: Environment[];
        masterKeys: BackendMasterKey[];
        warning: string;
      }>("/api/projects", data);
      const result = response.data;

      // Map backend response to frontend format
      const mappedMasterKeys: MasterKey[] = result.masterKeys.map((key) => ({
        id: key.keyId,
        key: key.apiKey,
        name: `${key.environmentName} Master Key`,
        prefix: key.keyPrefix,
        createdAt: new Date().toISOString(),
      }));

      set((state) => ({
        projects: [...state.projects, result.project],
        currentProject: result.project,
        currentEnvironments: result.environments,
        masterKeys: mappedMasterKeys,
        isLoading: false,
      }));

      return { masterKeys: mappedMasterKeys };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create project";
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  setCurrentApiKey: (key: string) => set({ currentApiKey: key }),

  clearMasterKeys: () => set({ masterKeys: [], currentApiKey: null }),

  clearError: () => set({ error: null }),
}));
