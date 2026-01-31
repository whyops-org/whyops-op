/**
 * Core Types for WhyOps Platform
 */

// Provider types
export type ProviderType = 'openai' | 'anthropic';

export interface ProviderConfig {
  id: string;
  userId: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string; // Encrypted in database
  metadata?: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// API Key types
export interface ApiKey {
  id: string;
  userId: string;
  providerId: string;
  name: string;
  keyHash: string; // SHA-256 hash of the actual key
  keyPrefix: string; // First 8 chars for identification
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  rateLimit?: number; // Requests per minute
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// User types
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name?: string;
  organizationId?: string;
  isActive: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// LLM Event types (based on WhyOps docs)
export type EventType = 'llm_call' | 'tool_execution' | 'memory_retrieval' | 'planner_step' | 'agent_termination';

export interface BaseEvent {
  id: string;
  eventType: EventType;
  threadId: string;
  stepId: number;
  parentStepId?: number;
  spanId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  userId: string;
  providerId: string;
  createdAt: Date;
}

export interface LLMCallEvent extends BaseEvent {
  eventType: 'llm_call';
  provider: ProviderType;
  model: string;
  systemPrompt?: string;
  messages: any[]; // Message history
  tools?: any[]; // Available tools
  temperature?: number;
  maxTokens?: number;
  response?: {
    content?: string;
    toolCalls?: any[];
    finishReason?: string;
    responseId?: string;
  };
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs?: number;
  error?: string;
}

export interface ToolExecutionEvent extends BaseEvent {
  eventType: 'tool_execution';
  toolName: string;
  input: any;
  output?: any;
  error?: string;
  latencyMs?: number;
  retryCount?: number;
  rawOutput?: any; // Actual tool output before sanitization
}

export interface MemoryRetrievalEvent extends BaseEvent {
  eventType: 'memory_retrieval';
  query: string;
  rewrittenQuery?: string;
  documentsFound: number;
  documentsReturned: number;
  documents: any[];
  threshold?: number;
  latencyMs?: number;
}

export interface PlannerStepEvent extends BaseEvent {
  eventType: 'planner_step';
  strategy: string;
  confidence?: number;
  state: any;
  nextAction?: string;
}

export interface AgentTerminationEvent extends BaseEvent {
  eventType: 'agent_termination';
  reason: string;
  wasSuccessful: boolean;
  finalState?: any;
}

// Request Log types
export interface RequestLog {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  latencyMs: number;
  userId?: string;
  apiKeyId?: string;
  providerId?: string;
  userAgent?: string;
  ipAddress?: string;
  requestBody?: any;
  responseBody?: any;
  error?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  createdAt: Date;
}

// Analytics types
export interface UsageMetrics {
  userId: string;
  providerId: string;
  date: string; // YYYY-MM-DD
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  avgLatencyMs: number;
  errorCount: number;
  metadata?: Record<string, any>;
}
