import env from '@whyops/shared/env';
import { createServiceLogger } from '@whyops/shared/logger';
import { generateSpanId, generateThreadId } from '@whyops/shared/utils';
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { sendToAnalyse } from '../services/analyse';
import { OpenAIParser } from '../parsers/openai-parser';

const logger = createServiceLogger('proxy:openai');
const app = new Hono();

// OpenAI Chat Completions endpoint
app.post('/chat/completions', async (c) => {
  const auth = c.get('auth');
  const requestBody = await c.req.json();
  const isStreaming = requestBody.stream === true;

  const startTime = Date.now();
  const traceId = c.req.header('X-Thread-ID') || generateThreadId();
  // Generate a distinct span ID for this interaction request
  const requestSpanId = generateSpanId();

  logger.info({
    model: requestBody.model,
    stream: isStreaming,
    traceId,
  }, 'OpenAI request received');

  // 1. Send Request Event (User Message)
  sendToAnalyse({
    traceId,
    spanId: requestSpanId,
    eventType: 'user_message',
    userId: auth.userId,
    providerId: auth.providerId,
    content: requestBody.messages,
    metadata: {
      model: requestBody.model,
      provider: 'openai',
      params: {
        temperature: requestBody.temperature,
        maxTokens: requestBody.max_tokens,
      }
    }
  }).catch(err => logger.error({ err }, 'Failed to send request event'));

  try {
    const provider = auth.provider;
    const openaiUrl = `${provider.baseUrl}/chat/completions`;
    const headers = {
      'Authorization': `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'WhyOps-Proxy/1.0',
    };

    if (isStreaming) {
      return stream(c, async (stream) => {
        const response = await fetch(openaiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const error = await response.text();
          logger.error({ status: response.status, error }, 'OpenAI API error');
          
          sendToAnalyse({
            traceId,
            spanId: generateSpanId(), // New span for error response
            eventType: 'error',
            userId: auth.userId,
            providerId: auth.providerId,
            content: { error, status: response.status },
            metadata: { latencyMs: Date.now() - startTime }
          });
          
          await stream.write(JSON.stringify({ error: 'Provider API error', details: error }));
          return;
        }

        let accumulatedState = OpenAIParser.getInitialStreamState();
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error('No response body');

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '));
            
            for (const line of lines) {
              const data = line.replace('data: ', '').trim();
              if (data === '[DONE]') {
                await stream.write(`data: [DONE]\n\n`);
                continue;
              }
              try {
                const parsed = JSON.parse(data);
                accumulatedState = OpenAIParser.parseStreamChunk(parsed, accumulatedState);
                await stream.write(`data: ${data}\n\n`);
              } catch (e) { }
            }
          }

          // 2. Send Response Event (LLM Response)
          sendToAnalyse({
            traceId,
            spanId: generateSpanId(), // New span for response
            eventType: 'llm_response',
            userId: auth.userId,
            providerId: auth.providerId,
            content: {
              content: accumulatedState.content,
              toolCalls: accumulatedState.toolCalls,
              finishReason: accumulatedState.finishReason,
            },
            metadata: {
              model: requestBody.model,
              provider: 'openai',
              usage: accumulatedState.usage,
              latencyMs: Date.now() - startTime,
            }
          }).catch(err => logger.error({ err }, 'Failed to send response event'));

        } finally {
          reader.releaseLock();
        }
      });
    } else {
      // Non-streaming logic
      const response = await fetch(openaiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(env.PROXY_TIMEOUT_MS),
      });

      const latencyMs = Date.now() - startTime;
      const responseData = await response.json();

      if (!response.ok) {
        sendToAnalyse({
          traceId,
          spanId: generateSpanId(),
          eventType: 'error',
          userId: auth.userId,
          providerId: auth.providerId,
          content: responseData,
          metadata: { latencyMs }
        });
        return c.json(responseData, response.status as any);
      }

      const parsedResponse = OpenAIParser.parseResponse(responseData);

      // 2. Send Response Event
      sendToAnalyse({
        traceId,
        spanId: generateSpanId(),
        eventType: 'llm_response',
        userId: auth.userId,
        providerId: auth.providerId,
        content: {
          content: parsedResponse.content,
          toolCalls: parsedResponse.toolCalls,
          finishReason: parsedResponse.finishReason,
        },
        metadata: {
          model: requestBody.model,
          provider: 'openai',
          usage: parsedResponse.usage,
          latencyMs,
        }
      }).catch(err => logger.error({ err }, 'Failed to send response event'));

      return c.json(responseData);
    }
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    sendToAnalyse({
      traceId,
      spanId: generateSpanId(),
      eventType: 'error',
      userId: auth.userId,
      providerId: auth.providerId,
      content: { message: error.message },
      metadata: { latencyMs }
    });
    return c.json({ error: error.message }, 500);
  }
});

// OpenAI Models endpoint
app.get('/models', async (c) => {
  const auth = c.get('auth');
  
  try {
    const provider = auth.provider;
    const response = await fetch(`${provider.baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
      },
    });

    const data = await response.json();
    return c.json(data);
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch models');
    return c.json({ error: error.message }, 500);
  }
});

// Other OpenAI endpoints can be added here (embeddings, images, etc.)

export default app;
