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
  environmentId: string;
  name: string;
  prefix: string;
  key?: string;
  canReveal?: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

interface BackendMasterKey {
  keyId: string;
  apiKey: string;
  environmentId: string;
  environmentName: string;
  keyPrefix: string;
}

interface ProjectWithEnvironments extends Project {
  environments?: Environment[];
}

interface PersistedApiKey {
  id: string;
  projectId: string;
  environmentId: string;
  stage: string;
  keyPrefix: string;
  canReveal: boolean;
  isMaster: boolean;
  isActive: boolean;
  createdAt: string;
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
  createApiKey: (input: { projectId: string; environmentId: string; environmentName: string }) => Promise<MasterKey>;
  setCurrentApiKey: (key: string) => void;
  clearMasterKeys: () => void;
  clearError: () => void;
}

function mapNewMasterKey(key: BackendMasterKey): MasterKey {
  return {
    id: key.keyId,
    environmentId: key.environmentId,
    key: key.apiKey,
    name: `${key.environmentName} Master Key`,
    prefix: key.keyPrefix,
    canReveal: true,
    createdAt: new Date().toISOString(),
  };
}

function mapPersistedKey(key: PersistedApiKey): MasterKey {
  return {
    id: key.id,
    environmentId: key.environmentId,
    name: `${key.stage} ${key.isMaster ? "Master Key" : "API Key"}`,
    prefix: key.keyPrefix,
    canReveal: key.canReveal,
    createdAt: key.createdAt,
  };
}

export const useProjectStore = create<ProjectState>((set, get) => ({
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
      const [projectsResponse, apiKeysResponse] = await Promise.all([
        apiClient.get<{ projects: ProjectWithEnvironments[] }>("/api/projects"),
        apiClient.get<{ apiKeys: PersistedApiKey[] }>("/api/api-keys/stages"),
      ]);
      const projects = (projectsResponse.data.projects || []).filter((project) => project.isActive);
      const existingProjectId = get().currentProject?.id;
      const currentProject =
        projects.find((project) => project.id === existingProjectId) || projects[0] || null;
      const currentEnvironments = (currentProject?.environments || []).filter((env) => env.isActive);
      const masterKeys = currentProject
        ? (apiKeysResponse.data.apiKeys || [])
            .filter((key) => key.projectId === currentProject.id && key.isActive)
            .sort((left, right) => Number(right.isMaster) - Number(left.isMaster))
            .map(mapPersistedKey)
        : [];

      set({ projects, currentProject, currentEnvironments, masterKeys, isLoading: false });
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
      const mappedMasterKeys = result.masterKeys.map(mapNewMasterKey);

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
  createApiKey: async ({ projectId, environmentId, environmentName }) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post<{
        id: string;
        apiKey: string;
        keyPrefix: string;
        createdAt: string;
      }>("/api/api-keys", {
        projectId,
        environmentId,
        name: `${environmentName} Onboarding Key`,
      });
      const nextKey: MasterKey = {
        id: response.data.id,
        environmentId,
        key: response.data.apiKey,
        name: `${environmentName} Onboarding Key`,
        prefix: response.data.keyPrefix,
        canReveal: true,
        createdAt: response.data.createdAt,
      };
      set((state) => ({
        masterKeys: [...state.masterKeys.filter((key) => key.id !== nextKey.id), nextKey],
        isLoading: false,
      }));
      return nextKey;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create API key";
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  setCurrentApiKey: (key: string) => set({ currentApiKey: key }),

  clearMasterKeys: () => set({ masterKeys: [], currentApiKey: null }),

  clearError: () => set({ error: null }),
}));
