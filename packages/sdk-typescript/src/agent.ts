import { ENDPOINTS, LOG_PREFIX } from './config.js';
import { post } from './http.js';
import type { AgentInfo, AgentMetadata } from './types.js';

export class AgentRegistry {
  private cache = new Map<string, AgentInfo>();

  constructor(
    private readonly apiKey: string,
    private readonly proxyBaseUrl: string,
    private readonly analyseBaseUrl: string,
  ) {}

  async ensure(agentName: string, metadata: AgentMetadata): Promise<AgentInfo | null> {
    const key = `${agentName}:${stableHash(metadata)}`;
    const hit = this.cache.get(key);
    if (hit) return hit;

    const info = await this.init(agentName, metadata);
    if (info) this.cache.set(key, info);
    return info;
  }

  async init(agentName: string, metadata: AgentMetadata): Promise<AgentInfo | null> {
    const urls = [
      `${this.analyseBaseUrl}${ENDPOINTS.agentInitPrimary}`,
      `${this.proxyBaseUrl}${ENDPOINTS.agentInitFallback}`,
    ];
    const body = { agentName, metadata: { tools: [], ...metadata } };
    const headers = { Authorization: `Bearer ${this.apiKey}` };

    for (const url of urls) {
      try {
        const res = await post<{ success: boolean } & AgentInfo>(url, body, headers);
        if (res.ok && res.data.agentId) {
          return {
            agentId: res.data.agentId,
            agentVersionId: res.data.agentVersionId,
            status: res.data.status,
            versionHash: res.data.versionHash,
          };
        }
      } catch {
        // try next url
      }
    }

    console.error(`${LOG_PREFIX} agent init failed — continuing without registration`);
    return null;
  }
}

function stableHash(obj: unknown): string {
  return JSON.stringify(sortKeys(obj));
}

function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  return Object.fromEntries(
    Object.keys(obj as Record<string, unknown>)
      .sort()
      .map((k) => [k, sortKeys((obj as Record<string, unknown>)[k])]),
  );
}
