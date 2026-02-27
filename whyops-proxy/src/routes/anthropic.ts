import type { ApiKeyAuthContext } from '@whyops/shared/middleware';
import env from '@whyops/shared/env';
import { createServiceLogger } from '@whyops/shared/logger';
import { generateSpanId, generateThreadId } from '@whyops/shared/utils';
import { Hono } from 'hono';
import { dispatchAnalyseEvent } from '../services/async-events';
import { copyProxyResponseHeaders, resolveProviderFromModel, validateResolvedProvider } from '../services/proxy-routing';
import { SseEventDecoder } from '../services/sse';
import { AnthropicParser } from '../parsers/anthropic-parser';
import type { AnthropicMessagesRequest, AnthropicMessageResponse, AnthropicStreamEvent } from '../types/anthropic';

const logger = createServiceLogger('proxy:anthropic');
const app = new Hono();

function determineAnthropicRequestEventType(messages: any[] | undefined): 'user_message' | 'tool_result' {
  if (!messages || !Array.isArray(messages)) return 'user_message';

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const role = msg?.role;
    if (role === 'system') continue;

    const content = msg?.content;
    if (Array.isArray(content) && content.some((item: any) => item?.type === 'tool_result')) {
      return 'tool_result';
    }

    return 'user_message';
  }

  return 'user_message';
}

function responseFromUpstreamError(status: number, contentType: string | null, body: string): Response {
  const headers = new Headers();
  if (contentType) {
    headers.set('content-type', contentType);
  }
  return new Response(body, { status, headers });
}

async function trackAnthropicStream(
  streamBody: ReadableStream<Uint8Array>,
  apiKey: string,
  traceId: string,
  spanId: string,
  providerId: string | undefined,
  agentName: string,
  model: string,
  requestBody: AnthropicMessagesRequest,
  startTime: number
): Promise<void> {
  const reader = streamBody.getReader();
  const decoder = new TextDecoder();
  const sseDecoder = new SseEventDecoder();
  let accumulatedState = AnthropicParser.getInitialStreamState();
  const toolCallState = new Map<number, any>();
  const thinkingState = new Map<number, any>();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const textChunk = decoder.decode(value, { stream: true });
      const events = sseDecoder.push(textChunk);

      for (const data of events) {
        try {
          const parsed = JSON.parse(data) as AnthropicStreamEvent;
          accumulatedState = AnthropicParser.parseStreamEvent(parsed, accumulatedState, toolCallState, thinkingState);
        } catch {
          // Ignore malformed chunks for analytics only path
        }
      }
    }

    const finalEvents = sseDecoder.flush();
    for (const data of finalEvents) {
      try {
        const parsed = JSON.parse(data) as AnthropicStreamEvent;
        accumulatedState = AnthropicParser.parseStreamEvent(parsed, accumulatedState, toolCallState, thinkingState);
      } catch {
        // Ignore malformed chunks for analytics only path
      }
    }

    const latencyMs = Date.now() - startTime;
    dispatchAnalyseEvent(apiKey, {
      eventType: 'llm_response',
      traceId,
      spanId,
      providerId,
      agentName,
      content: {
        content: accumulatedState.content,
        finishReason: accumulatedState.finishReason,
        toolCalls: accumulatedState.toolCalls,
      },
      metadata: {
        provider: 'anthropic',
        model,
        systemPrompt: requestBody.system,
        tools: requestBody.tools,
        temperature: requestBody.temperature,
        maxTokens: requestBody.max_tokens,
        usage: accumulatedState.usage,
        latencyMs,
      }
    });

    const thinkingBlocks = accumulatedState.thinkingBlocks && accumulatedState.thinkingBlocks.length > 0
      ? accumulatedState.thinkingBlocks
      : Array.from(thinkingState.values());

    if (thinkingBlocks.length > 0) {
      for (const block of thinkingBlocks) {
        dispatchAnalyseEvent(apiKey, {
          eventType: 'llm_thinking',
          traceId,
          spanId: generateSpanId(),
          providerId,
          agentName,
          content: block,
          metadata: {
            provider: 'anthropic',
            model,
          },
        });
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// Anthropic Messages endpoint
app.post('/messages', async (c) => {
  const auth = c.get('whyopsAuth') as ApiKeyAuthContext;
  const requestBody = await c.req.json() as AnthropicMessagesRequest;
  const isStreaming = requestBody.stream === true;

  const startTime = Date.now();
  const agentName = c.req.header('X-Agent-Name');

  if (!agentName) {
    return c.json({ error: 'Missing required header: X-Agent-Name' }, 400);
  }

  const { provider, isCustom, providerSlug, actualModel } = await resolveProviderFromModel(
    auth.userId,
    requestBody.model,
    auth.provider
  );

  const providerValidation = validateResolvedProvider(provider);
  if (!providerValidation.valid) {
    return c.json({ error: providerValidation.message }, 400);
  }

  // Use actual model for the API call
  requestBody.model = actualModel;

  const traceId = c.req.header('X-Trace-ID') || c.req.header('X-Thread-ID') || generateThreadId();
  const spanId = generateSpanId();

  logger.info({
    model: actualModel,
    providerSlug,
    isCustom,
    stream: isStreaming,
    traceId,
  }, 'Anthropic request received');

  try {
    // Build request to Anthropic
    const baseUrl = provider.baseUrl.endsWith('/v1') ? provider.baseUrl : `${provider.baseUrl}/v1`;
    const anthropicUrl = `${baseUrl}/messages`;
    const headers = {
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
      'User-Agent': 'WhyOps-Proxy/1.0',
    };

    dispatchAnalyseEvent(auth.apiKey, {
      eventType: determineAnthropicRequestEventType(requestBody.messages),
      traceId,
      spanId,
      providerId: provider?.id,
      agentName,
      content: requestBody.messages,
      metadata: {
        provider: isCustom ? 'custom' : 'anthropic',
        providerSlug: providerSlug || undefined,
        model: requestBody.model,
        systemPrompt: requestBody.system,
        tools: requestBody.tools,
        temperature: requestBody.temperature,
        maxTokens: requestBody.max_tokens,
        topP: requestBody.top_p,
        topK: requestBody.top_k,
        stopSequences: requestBody.stop_sequences,
        toolChoice: requestBody.tool_choice,
        thinking: requestBody.thinking,
      }
    });

    if (isStreaming) {
      const response = await fetch(anthropicUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error({ status: response.status, errorBody }, 'Anthropic API error');

        dispatchAnalyseEvent(auth.apiKey, {
          eventType: 'error',
          traceId,
          spanId: generateSpanId(),
          providerId: provider?.id,
          agentName,
          content: { error: errorBody, status: response.status },
          metadata: {
            provider: 'anthropic',
            model: requestBody.model,
            latencyMs: Date.now() - startTime,
          },
        });

        return responseFromUpstreamError(response.status, response.headers.get('content-type'), errorBody);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const [clientBranch, analyticsBranch] = response.body.tee();
      trackAnthropicStream(
        analyticsBranch,
        auth.apiKey,
        traceId,
        spanId,
        provider?.id,
        agentName,
        requestBody.model,
        requestBody,
        startTime
      ).catch((error) => logger.warn({ error, traceId }, 'Failed to parse Anthropic streaming analytics'));

      const upstreamHeaders = copyProxyResponseHeaders(response.headers);
      upstreamHeaders.set('X-Trace-ID', traceId);
      upstreamHeaders.set('X-Thread-ID', traceId);

      return new Response(clientBranch, {
        status: response.status,
        headers: upstreamHeaders,
      });
    } else {
      // Handle non-streaming response
      const response = await fetch(anthropicUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(env.PROXY_TIMEOUT_MS),
      });

      const latencyMs = Date.now() - startTime;
      const responseData = await response.json() as AnthropicMessageResponse;

      if (!response.ok) {
        logger.error({ status: response.status, responseData }, 'Anthropic API error');
        
        dispatchAnalyseEvent(auth.apiKey, {
          eventType: 'error',
          traceId,
          spanId: generateSpanId(),
          providerId: provider?.id,
          agentName,
          content: responseData,
          metadata: {
            provider: 'anthropic',
            model: requestBody.model,
            latencyMs,
          },
        });
        
        return c.json(responseData, response.status as any);
      }

      const parsedResponse = AnthropicParser.parseResponse(responseData);

      dispatchAnalyseEvent(auth.apiKey, {
        eventType: 'llm_response',
        traceId,
        spanId,
        providerId: provider?.id,
        agentName,
        content: {
          content: parsedResponse.content,
          finishReason: parsedResponse.finishReason,
          toolCalls: parsedResponse.toolCalls,
        },
        metadata: {
          provider: 'anthropic',
          model: requestBody.model,
          systemPrompt: requestBody.system,
          tools: requestBody.tools,
          temperature: requestBody.temperature,
          maxTokens: requestBody.max_tokens,
          usage: parsedResponse.usage,
          latencyMs,
        },
      });

      if (parsedResponse.thinkingBlocks && parsedResponse.thinkingBlocks.length > 0) {
        for (const block of parsedResponse.thinkingBlocks) {
          dispatchAnalyseEvent(auth.apiKey, {
            eventType: 'llm_thinking',
            traceId,
            spanId: generateSpanId(),
            providerId: provider?.id,
            agentName,
            content: block,
            metadata: {
              provider: 'anthropic',
              model: requestBody.model,
            },
          });
        }
      }

      logger.info({ traceId, latencyMs, model: requestBody.model }, 'Request completed');

      // Return response to client
      return c.json(responseData);
    }
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    logger.error({ error, traceId }, 'Request failed');

    dispatchAnalyseEvent(auth.apiKey, {
      eventType: 'error',
      traceId,
      spanId: generateSpanId(),
      providerId: provider?.id,
      agentName,
      content: { message: error.message },
      metadata: {
        provider: 'anthropic',
        model: requestBody.model,
        latencyMs,
      },
    });

    return c.json({ error: error.message }, 500);
  }
});

export default app;
