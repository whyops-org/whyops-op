import { createServiceLogger } from '@whyops/shared/logger';
import env from '@whyops/shared/env';

const logger = createServiceLogger('proxy:analyse');

interface AnalysePayload {
  eventType: string;
  threadId: string;
  spanId: string;
  userId: string;
  providerId: string;
  provider: 'openai' | 'anthropic';
  model: string;
  systemPrompt?: string;
  messages?: any[];
  tools?: any[];
  temperature?: number;
  maxTokens?: number;
  response?: {
    content?: string;
    toolCalls?: any[];
    finishReason?: string;
  };
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs?: number;
  error?: string;
}

/**
 * Send event data to the analyse service (non-blocking)
 * This is fire-and-forget to ensure zero latency impact on proxy
 */
export async function sendToAnalyse(payload: AnalysePayload): Promise<void> {
  try {
    const analyseUrl = `${env.ANALYSE_URL}/api/events`;
    
    // Fire-and-forget request
    fetch(analyseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Service': 'proxy',
      },
      body: JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
      }),
      // Use keepalive to allow request to continue even if response is not read
      // @ts-ignore - keepalive is valid but not in TypeScript types yet
      keepalive: true,
    }).catch((error) => {
      // Log error but don't throw - this is non-blocking
      logger.error({ error, threadId: payload.threadId }, 'Failed to send to analyse service');
    });

    logger.debug({ threadId: payload.threadId, eventType: payload.eventType }, 'Event sent to analyse service');
  } catch (error) {
    // Never throw errors - this is non-blocking
    logger.error({ error }, 'Error in sendToAnalyse');
  }
}
