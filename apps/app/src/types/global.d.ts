// Global type definitions for WhyOps app

// ============ Agent Types ============

export interface AgentVersion {
  id: string;
  hash: string;
  metadata: {
    tools?: string[];
    systemPrompt?: string;
  };
  samplingRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  userId: string;
  projectId: string;
  environmentId: string;
  name: string;
  externalUserId?: string | null;
  maxTraces?: number;
  maxSpans?: number;
  traceCount: number;
  successPercentage: number | Record<string, number>;
  successRatePeriod?: number;
  traceCounts?: Record<string, number>;
  traceCountPeriod?: number;
  lastActive: string;
  createdAt: string;
  updatedAt: string;
  latestVersion?: AgentVersion;
  versions?: AgentVersion[];
}

export interface Pagination {
  total: number;
  count: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export interface AgentsResponse {
  success: boolean;
  agents: Agent[];
  pagination: Pagination;
}

export interface SingleAgentResponse {
  success: boolean;
  id: string;
  userId: string;
  projectId: string;
  environmentId: string;
  name: string;
  externalUserId?: string | null;
  maxTraces?: number;
  maxSpans?: number;
  traceCount: number;
  successPercentage: Record<string, number>;
  successRatePeriod: number;
  traceCounts: Record<string, number>;
  traceCountPeriod: number;
  lastActive: string;
  createdAt: string;
  updatedAt: string;
  latestVersion: AgentVersion;
  versions: AgentVersion[];
}

// ============ Config Types ============

export interface Config {
  authBaseUrl: string;
  proxyBaseUrl: string;
  analyseBaseUrl: string;
  apiBaseUrl?: string;
}

export interface AgentSettings {
  agentId: string;
  samplingRate: number;
  maxTraces: number;
  maxSpans: number;
  updatedAt: string;
}

export interface AgentGlobalLimits {
  maxAgents: number;
  permissions?: {
    canChangeAgentMaxTraces: boolean;
    canChangeAgentMaxSpans: boolean;
    canChangeMaxAgents: boolean;
  };
}

// ============ Dashboard Types ============

export interface DashboardStats {
  totalAgents: number;
  activeTraces: number;
  successRate: number;
  avgLatency: string;
}

export interface ChartDataPoint {
  date: string;
  successRate: number;
}

export interface DashboardState {
  stats: DashboardStats | null;
  chartData: ChartDataPoint[];
  isLoading: boolean;
  error: string | null;
}

// ============ Auth Types ============

export type OnboardingStep = "welcome" | "workspace" | "complete";

export interface OnboardingProgress {
  hasProvider: boolean;
  hasProject: boolean;
  onboardingComplete: boolean;
  currentStep: OnboardingStep;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  onboardingComplete?: boolean;
}

// ============ Provider Types ============

export interface Provider {
  id: string;
  name: string;
  slug: string;
  models: Model[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Model {
  id: string;
  providerId: string;
  name: string;
  modelId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============ Project Types ============

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// ============ Trace Types ============

export interface Trace {
  id: string;
  agentId: string;
  name: string;
  status: "success" | "error" | "running";
  startTime: string;
  endTime?: string;
  duration?: number;
  tokensUsed?: number;
  cost?: number;
  events: TraceEvent[];
}

export interface TraceEvent {
  id: string;
  traceId: string;
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// ============ Connection Types ============

export interface Connection {
  id: string;
  name: string;
  type: "database" | "api" | "service";
  status: "connected" | "disconnected";
  lastSync?: string;
}

// ============ Thread Types ============

export interface Thread {
  id: string;
  agentId: string;
  name: string;
  status: "active" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

// ============ Events Types ============

export interface AgentEvent {
  id: string;
  agentId: string;
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

// ============ Workspace Types ============

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "pro" | "enterprise";
  createdAt: string;
  updatedAt: string;
}
