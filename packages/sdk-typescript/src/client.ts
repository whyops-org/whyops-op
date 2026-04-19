import { AgentRegistry } from './agent.js';
import { DEFAULT_ANALYSE_URL, DEFAULT_PROXY_URL } from './config.js';
import { patchAnthropic, patchOpenAI } from './proxy.js';
import { WhyOpsTrace } from './trace.js';
import type { AgentInfo, AgentMetadata, WhyOpsConfig } from './types.js';

export class WhyOps {
  private readonly apiKey: string;
  private readonly agentName: string;
  private readonly agentMetadata: AgentMetadata;
  private readonly proxyBaseUrl: string;
  private readonly analyseBaseUrl: string;
  private readonly registry: AgentRegistry;
  private initPromise: Promise<AgentInfo | null> | null = null;

  constructor(config: WhyOpsConfig) {
    this.apiKey = config.apiKey;
    this.agentName = config.agentName;
    this.agentMetadata = config.agentMetadata;
    // Fall back to defaults from config.json if not provided
    this.proxyBaseUrl = config.proxyBaseUrl || DEFAULT_PROXY_URL;
    this.analyseBaseUrl = config.analyseBaseUrl || DEFAULT_ANALYSE_URL;
    this.registry = new AgentRegistry(this.apiKey, this.proxyBaseUrl, this.analyseBaseUrl);
  }

  /**
   * Explicitly initialise the agent. Called automatically before the first
   * event/trace — only call this manually if you want to surface init errors.
   */
  async initAgent(): Promise<AgentInfo | null> {
    if (!this.initPromise) {
      this.initPromise = this.registry.ensure(this.agentName, this.agentMetadata);
    }
    return this.initPromise;
  }

  /**
   * Create a trace builder for a given session / conversation ID.
   *
   * @param traceId  Your session or conversation identifier.
   */
  trace(traceId: string): WhyOpsTrace {
    return new WhyOpsTrace(
      traceId,
      this.agentName,
      this.apiKey,
      this.analyseBaseUrl,
      () => this.initAgent().then(() => void 0),
    );
  }

  /**
   * Patch an OpenAI client to route through the WhyOps proxy.
   *
   * @example
   * const openai = whyops.openai(new OpenAI({ apiKey: process.env.WHYOPS_API_KEY }));
   */
  openai<T extends object>(client: T): T {
    return patchOpenAI(client as any, this.proxyBaseUrl, this.apiKey, this.agentName) as T;
  }

  /**
   * Patch an Anthropic client to route through the WhyOps proxy.
   *
   * @example
   * const anthropic = whyops.anthropic(new Anthropic({ apiKey: process.env.WHYOPS_API_KEY }));
   */
  anthropic<T extends object>(client: T): T {
    return patchAnthropic(client as any, this.proxyBaseUrl, this.apiKey, this.agentName) as T;
  }
}
