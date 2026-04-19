import env from '@whyops/shared/env';
import { Hono } from 'hono';
import { ResponseUtil } from '../utils';

const app = new Hono();

/**
 * Configuration endpoint for onboarding flow
 * Returns all configurable data that was previously hardcoded in the frontend
 */
app.get('/', (c) => {
  c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');

  const config = {
    // API Base URLs for different services
    authBaseUrl: env.AUTH_URL || 'http://localhost:8082',
    proxyBaseUrl: env.PROXY_URL || 'http://localhost:8080',
    analyseBaseUrl: (env.ANALYSE_URL || 'http://localhost:8081') + '/api', // Legacy alias (for backward compatibility)

    // Legacy alias (for backward compatibility)
    apiBaseUrl: env.PROXY_URL || 'http://localhost:8080',

    // Supported LLM providers
    providerTypes: [
      {
        type: 'openai',
        name: 'OpenAI',
        detail: 'GPT-4o, GPT-3.5 Turbo',
        defaultBaseUrl: 'https://api.openai.com/v1',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      },
      {
        type: 'anthropic',
        name: 'Anthropic',
        detail: 'Claude 3.5 Sonnet, Haiku',
        defaultBaseUrl: 'https://api.anthropic.com',
        models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
      },
    ],
    // Supported environments
    environments: [
      { name: 'PRODUCTION', displayName: 'Production', description: 'Production environment' },
      { name: 'STAGING', displayName: 'Staging', description: 'Staging/QA environment' },
      { name: 'DEVELOPMENT', displayName: 'Development', description: 'Development environment' },
    ],
    // Supported SDK languages
    sdkLanguages: [
      { id: 'python', label: 'Python', icon: '/assets/languages/python.svg?v=2', installCommand: 'pip install whyops' },
      { id: 'typescript', label: 'TypeScript', icon: '/assets/languages/typescript.svg?v=3', installCommand: 'npm install @whyops/sdk openai' },
      { id: 'go', label: 'Go', icon: '/assets/languages/go.svg?v=2', installCommand: 'go get github.com/whyops-org/whyops-op/packages/sdk-go@latest' },
      { id: 'http', label: 'HTTP API', icon: '/assets/languages/http-api.svg?v=2', installCommand: 'curl -X POST https://a.whyops.com/api/events/ingest' },
    ],
    // Onboarding checklist steps
    onboardingSteps: [
      { id: 'welcome', label: 'Welcome', order: 0 },
      { id: 'workspace', label: 'Workspace', order: 1 },
      { id: 'complete', label: 'Complete', order: 2 },
    ],
    // Onboarding checklist items
    onboardingChecklist: [
      { id: 'create-workspace', text: 'Create your workspace and API key', icon: 'Key' },
      { id: 'choose-ingestion', text: 'Choose manual events or the proxy', icon: 'Link' },
      { id: 'capture-trace', text: 'Capture your first trace', icon: 'Activity' },
    ],
    // SDK initialization template
    sdkConfig: {
      python: {
        decorator: 'trace.user_message_sync',
        initFunction: 'WhyOps(...)',
        initParams: {
          api_key: 'string',
          environment: 'string',
        },
      },
      typescript: {
        decorator: 'trace.userMessage',
        initFunction: 'new WhyOps(...)',
        initParams: {
          apiKey: 'string',
          environment: 'string',
        },
      },
      go: {
        decorator: 'trace.UserMessage',
        initFunction: 'whyops.New(...)',
        initParams: {
          APIKey: 'string',
          AgentName: 'string',
        },
      },
      http: {
        decorator: 'Authorization: Bearer',
        initFunction: 'POST /api/events/ingest',
        initParams: {
          traceId: 'string',
          agentName: 'string',
        },
      },
    },

    // Runtime limits and sampling defaults
    limits: {
      defaultSamplingRate: Number(env.DEFAULT_TRACE_SAMPLING_RATE),
      defaultTraceSamplingRate: Number(env.DEFAULT_TRACE_SAMPLING_RATE),
      maxAgents: Number(env.MAX_AGENTS_PER_ACCOUNT || env.MAX_AGENTS_PER_PROJECT),
      maxAgentsPerProject: Number(env.MAX_AGENTS_PER_ACCOUNT || env.MAX_AGENTS_PER_PROJECT),
    },

    // Top-level aliases for backwards/forwards compatibility
    defaultSamplingRate: Number(env.DEFAULT_TRACE_SAMPLING_RATE),
    defaultTraceSamplingRate: Number(env.DEFAULT_TRACE_SAMPLING_RATE),
    maxAgents: Number(env.MAX_AGENTS_PER_ACCOUNT || env.MAX_AGENTS_PER_PROJECT),
    maxAgentsPerProject: Number(env.MAX_AGENTS_PER_ACCOUNT || env.MAX_AGENTS_PER_PROJECT),
  };

  return ResponseUtil.success(c, config);
});

export default app;
