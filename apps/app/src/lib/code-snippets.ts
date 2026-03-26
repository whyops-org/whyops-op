/**
 * Code snippets utility for the onboarding complete step
 * Generates API code examples based on user configuration
 */

export interface CodeSnippetData {
  apiKey: string;
  apiKeyPrefix: string;
  projectId: string;
  environmentId: string;
  providerSlug: string;
}

export interface CodeSnippetConfig {
  proxyBaseUrl: string;
  analyseBaseUrl: string;
  authBaseUrl: string;
}

export interface CodeSnippet {
  filename: string;
  code: string;
}

// ==================== PROXY SNIPPETS ====================

const PYTHON_PROXY_TEMPLATE = `import requests

# Your API credentials from WhyOps
WHYOPS_API_KEY = "{{apiKey}}"
WHYOPS_PROXY_URL = "{{proxyBaseUrl}}"
AGENT_NAME = "my-agent"
MODEL_NAME = "{{providerSlug}}/gpt-4o-mini"

# =============================================
# STEP 1: Initialize Agent (do this once)
# =============================================
def init_agent():
    """Initialize your agent to get agent version info"""
    response = requests.post(
        f"{WHYOPS_PROXY_URL}/v1/agents/init",
        headers={
            "Authorization": f"Bearer {WHYOPS_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "agentName": AGENT_NAME,
            "metadata": {
                "systemPrompt": "You are a helpful AI assistant.",
                "tools": []
            }
        }
    )
    data = response.json()
    print(f"Agent initialized: {data.get('status')}, Version: {data.get('versionHash', 'N/A')[:8]}")
    return data

# Initialize on startup
agent_info = init_agent()

# =============================================
# STEP 2: Call LLM through Proxy
# =============================================
def call_llm(messages, model=MODEL_NAME):
    """Call LLM through WhyOps proxy"""
    response = requests.post(
        f"{WHYOPS_PROXY_URL}/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {WHYOPS_API_KEY}",
            "Content-Type": "application/json",
            "X-Agent-Name": AGENT_NAME,
        },
        json={
            "model": model,
            "messages": messages,
        }
    )
    return response.json()

# Example usage
messages = [{"role": "user", "content": "Hello!"}]
response = call_llm(messages)
print(response)`;

const JAVASCRIPT_PROXY_TEMPLATE = `const axios = require('axios');

const WHYOPS_API_KEY = "{{apiKey}}";
const WHYOPS_PROXY_URL = "{{proxyBaseUrl}}";
const AGENT_NAME = "my-agent";
const MODEL_NAME = "{{providerSlug}}/gpt-4o-mini";

// =============================================
// STEP 1: Initialize Agent (do this once)
// =============================================
async function initAgent() {
  const response = await axios.post(
    \`\${WHYOPS_PROXY_URL}/v1/agents/init\`,
    {
      agentName: AGENT_NAME,
      metadata: {
        systemPrompt: "You are a helpful AI assistant.",
        tools: []
      }
    },
    {
      headers: {
        "Authorization": \`Bearer \${WHYOPS_API_KEY}\`,
        "Content-Type": "application/json"
      }
    }
  );
  const data = response.data;
  console.log(\`Agent initialized: \${data.status}, Version: \${(data.versionHash || '').slice(0, 8)}\`);
  return data;
}

// =============================================
// STEP 2: Call LLM through Proxy
// =============================================
async function callLLM(messages, model = MODEL_NAME) {
  const response = await axios.post(
    \`\${WHYOPS_PROXY_URL}/v1/chat/completions\`,
    {
      model,
      messages,
    },
    {
      headers: {
        "Authorization": \`Bearer \${WHYOPS_API_KEY}\`,
        "Content-Type": "application/json",
        "X-Agent-Name": AGENT_NAME,
      },
    }
  );
  return response.data;
}

// Initialize on startup
await initAgent();

const messages = [{ role: "user", content: "Hello!" }];
const response = await callLLM(messages);
console.log(response);`;

const TYPESCRIPT_PROXY_TEMPLATE = `import axios from 'axios';

const WHYOPS_API_KEY = "{{apiKey}}";
const WHYOPS_PROXY_URL = "{{proxyBaseUrl}}";
const AGENT_NAME = "my-agent";
const MODEL_NAME = "{{providerSlug}}/gpt-4o-mini";

// =============================================
// STEP 1: Initialize Agent (do this once)
// =============================================
async function initAgent() {
  const response = await axios.post(
    \`\${WHYOPS_PROXY_URL}/v1/agents/init\`,
    {
      agentName: AGENT_NAME,
      metadata: {
        systemPrompt: "You are a helpful AI assistant.",
        tools: []
      }
    },
    {
      headers: {
        "Authorization": \`Bearer \${WHYOPS_API_KEY}\`,
        "Content-Type": "application/json"
      }
    }
  );
  const data = response.data;
  console.log(\`Agent initialized: \${data.status}, Version: \${(data.versionHash || '').slice(0, 8)}\`);
  return data;
}

// =============================================
// STEP 2: Call LLM through Proxy
// =============================================
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

async function callLLM(messages: Message[], model = MODEL_NAME) {
  const response = await axios.post(
    \`\${WHYOPS_PROXY_URL}/v1/chat/completions\`,
    {
      model,
      messages,
    },
    {
      headers: {
        "Authorization": \`Bearer \${WHYOPS_API_KEY}\`,
        "Content-Type": "application/json",
        "X-Agent-Name": AGENT_NAME,
      },
    }
  );
  return response.data;
}

// Initialize on startup
await initAgent();

const messages: Message[] = [{ role: "user", content: "Hello!" }];
const response = await callLLM(messages);
console.log(response);`;

// ==================== MANUAL EVENTS SNIPPETS ====================

const PYTHON_EVENTS_TEMPLATE = `import requests

# Your API credentials from WhyOps
WHYOPS_API_KEY = "{{apiKey}}"
WHYOPS_ANALYSE_URL = "{{analyseBaseUrl}}"
AGENT_NAME = "my-agent"

# =============================================
# STEP 1: Initialize Agent (do this once)
# =============================================
def init_agent():
    """Initialize your agent to get agent version info"""
    response = requests.post(
        f"{WHYOPS_ANALYSE_URL}/entities/init",
        headers={
            "Authorization": f"Bearer {WHYOPS_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "agentName": AGENT_NAME,
            "metadata": {
                "systemPrompt": "You are a helpful AI assistant.",
                "tools": []
            }
        }
    )
    data = response.json()
    print(f"Agent initialized: {data.get('status')}, Version: {data.get('versionHash', 'N/A')[:8]}")
    return data

# Initialize on startup
agent_info = init_agent()

# =============================================
# STEP 2: Send Events Manually
# =============================================
def send_event(event_type, trace_id, content, metadata=None):
    """Send an event to WhyOps"""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {WHYOPS_API_KEY}"
    }
    payload = {
        "eventType": event_type,
        "traceId": trace_id,
        "agentName": AGENT_NAME,
        "content": content,
        "metadata": metadata or {}
    }
    response = requests.post(
        f"{WHYOPS_ANALYSE_URL}/events",
        json=payload,
        headers=headers
    )
    return response.json()

# Example usage
trace_id = "session-001"

# Send user message
send_event(
    "user_message",
    trace_id,
    {"text": "Hello, I need help with my order"}
)

# Send LLM response
send_event(
    "llm_response",
    trace_id,
    {"text": "I'd be happy to help you with your order!"},
    {"model": "gpt-4o-mini", "tokens": 150}
)

# Send tool call
send_event(
    "tool_call",
    trace_id,
    {
        "name": "get_weather",
        "arguments": {"location": "San Francisco"}
    },
    {"tool_id": "tool_123"}
)

print("Events sent successfully!")`;

const JAVASCRIPT_EVENTS_TEMPLATE = `const axios = require('axios');

const WHYOPS_API_KEY = "{{apiKey}}";
const WHYOPS_ANALYSE_URL = "{{analyseBaseUrl}}";
const AGENT_NAME = "my-agent";

// =============================================
// STEP 1: Initialize Agent (do this once)
// =============================================
async function initAgent() {
  const response = await axios.post(
    \`\${WHYOPS_ANALYSE_URL}/entities/init\`,
    {
      agentName: AGENT_NAME,
      metadata: {
        systemPrompt: "You are a helpful AI assistant.",
        tools: []
      }
    },
    {
      headers: {
        "Authorization": \`Bearer \${WHYOPS_API_KEY}\`,
        "Content-Type": "application/json"
      }
    }
  );
  const data = response.data;
  console.log(\`Agent initialized: \${data.status}, Version: \${(data.versionHash || '').slice(0, 8)}\`);
  return data;
}

// =============================================
// STEP 2: Send Events Manually
// =============================================
async function sendEvent(eventType, traceId, content, metadata = {}) {
  const response = await axios.post(
    \`\${WHYOPS_ANALYSE_URL}/events\`,
    {
      eventType,
      traceId,
      agentName: AGENT_NAME,
      content,
      metadata
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Authorization": \`Bearer \${WHYOPS_API_KEY}\`
      }
    }
  );
  return response.data;
}

// Initialize on startup
await initAgent();

const traceId = "session-001";

await sendEvent("user_message", traceId, { text: "Hello, I need help with my order" });
await sendEvent("llm_response", traceId, { text: "I'd be happy to help!" }, { model: "gpt-4o-mini", tokens: 150 });
await sendEvent("tool_call", traceId, { name: "get_weather", arguments: { location: "San Francisco" } }, { tool_id: "tool_123" });

console.log("Events sent successfully!");`;

const TYPESCRIPT_EVENTS_TEMPLATE = `import axios from 'axios';

const WHYOPS_API_KEY = "{{apiKey}}";
const WHYOPS_ANALYSE_URL = "{{analyseBaseUrl}}";
const AGENT_NAME = "my-agent";

// =============================================
// STEP 1: Initialize Agent (do this once)
// =============================================
async function initAgent() {
  const response = await axios.post(
    \`\${WHYOPS_ANALYSE_URL}/entities/init\`,
    {
      agentName: AGENT_NAME,
      metadata: {
        systemPrompt: "You are a helpful AI assistant.",
        tools: []
      }
    },
    {
      headers: {
        "Authorization": \`Bearer \${WHYOPS_API_KEY}\`,
        "Content-Type": "application/json"
      }
    }
  );
  const data = response.data;
  console.log(\`Agent initialized: \${data.status}, Version: \${(data.versionHash || '').slice(0, 8)}\`);
  return data;
}

// =============================================
// STEP 2: Send Events Manually
// =============================================
interface EventPayload {
  eventType: string;
  traceId: string;
  agentName: string;
  content: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

async function sendEvent(
  eventType: string,
  traceId: string,
  content: Record<string, unknown>,
  metadata?: Record<string, unknown>
): Promise<void> {
  const payload: EventPayload = {
    eventType,
    traceId,
    agentName: AGENT_NAME,
    content,
    metadata
  };

  await axios.post(\`\${WHYOPS_ANALYSE_URL}/events\`, payload, {
    headers: {
      "Content-Type": "application/json",
      "Authorization": \`Bearer \${WHYOPS_API_KEY}\`
    }
  });
}

// Initialize on startup
await initAgent();

const traceId = "session-001";

await sendEvent("user_message", traceId, { text: "Hello!" });
await sendEvent("llm_response", traceId, { text: "Hi there!" }, { model: "gpt-4o-mini" });
await sendEvent("tool_call", traceId, { name: "get_weather", arguments: { location: "SF" } });

console.log("Events sent successfully!");`;

// ==================== EXPORTS ====================

export function getPythonProxySnippet(data: CodeSnippetData, config: CodeSnippetConfig): CodeSnippet {
  return {
    filename: "main_agent.py",
    code: PYTHON_PROXY_TEMPLATE
      .replace("{{apiKey}}", data.apiKey)
      .replace("{{proxyBaseUrl}}", config.proxyBaseUrl)
      .replace("{{providerSlug}}", data.providerSlug),
  };
}

export function getJavaScriptProxySnippet(data: CodeSnippetData, config: CodeSnippetConfig): CodeSnippet {
  return {
    filename: "main_agent.js",
    code: JAVASCRIPT_PROXY_TEMPLATE
      .replace("{{apiKey}}", data.apiKey)
      .replace("{{proxyBaseUrl}}", config.proxyBaseUrl)
      .replace("{{providerSlug}}", data.providerSlug),
  };
}

export function getTypeScriptProxySnippet(data: CodeSnippetData, config: CodeSnippetConfig): CodeSnippet {
  return {
    filename: "main_agent.ts",
    code: TYPESCRIPT_PROXY_TEMPLATE
      .replace("{{apiKey}}", data.apiKey)
      .replace("{{proxyBaseUrl}}", config.proxyBaseUrl)
      .replace("{{providerSlug}}", data.providerSlug),
  };
}

export function getPythonEventsSnippet(data: CodeSnippetData, config: CodeSnippetConfig): CodeSnippet {
  return {
    filename: "main_agent.py",
    code: PYTHON_EVENTS_TEMPLATE
      .replace("{{apiKey}}", data.apiKey)
      .replace("{{analyseBaseUrl}}", config.analyseBaseUrl),
  };
}

export function getJavaScriptEventsSnippet(data: CodeSnippetData, config: CodeSnippetConfig): CodeSnippet {
  return {
    filename: "main_agent.js",
    code: JAVASCRIPT_EVENTS_TEMPLATE
      .replace("{{apiKey}}", data.apiKey)
      .replace("{{analyseBaseUrl}}", config.analyseBaseUrl),
  };
}

export function getTypeScriptEventsSnippet(data: CodeSnippetData, config: CodeSnippetConfig): CodeSnippet {
  return {
    filename: "main_agent.ts",
    code: TYPESCRIPT_EVENTS_TEMPLATE
      .replace("{{apiKey}}", data.apiKey)
      .replace("{{analyseBaseUrl}}", config.analyseBaseUrl),
  };
}

export type SnippetType = 'proxy' | 'events';

export function getCodeSnippet(
  language: string,
  data: CodeSnippetData,
  config: CodeSnippetConfig,
  type: SnippetType = 'proxy'
): CodeSnippet {
  const generators = type === 'proxy'
    ? { python: getPythonProxySnippet, javascript: getJavaScriptProxySnippet, typescript: getTypeScriptProxySnippet }
    : { python: getPythonEventsSnippet, javascript: getJavaScriptEventsSnippet, typescript: getTypeScriptEventsSnippet };

  switch (language) {
    case 'python':
      return generators.python(data, config);
    case 'javascript':
      return generators.javascript(data, config);
    case 'typescript':
      return generators.typescript(data, config);
    default:
      return generators.python(data, config);
  }
}
