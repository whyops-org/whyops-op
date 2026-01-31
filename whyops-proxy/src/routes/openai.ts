import env from '@whyops/shared/env';
import { createServiceLogger } from '@whyops/shared/logger';
import { generateSpanId, generateThreadId } from '@whyops/shared/utils';
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { sendToAnalyse } from '../services/analyse';

const logger = createServiceLogger('proxy:openai');
const app = new Hono();

// OpenAI Chat Completions endpoint
app.post('/chat/completions', async (c) => {
  const auth = c.get('auth');
  const requestBody = await c.req.json();
  const isStreaming = requestBody.stream === true;

  const startTime = Date.now();
  const threadId = c.req.header('X-Thread-ID') || generateThreadId();
  const spanId = generateSpanId();

  logger.info({
    model: requestBody.model,
    stream: isStreaming,
    threadId,
  }, 'OpenAI request received');

  try {
    const provider = auth.provider;
    
    // Build request to OpenAI
    const openaiUrl = `${provider.baseUrl}/chat/completions`;
    const headers = {
      'Authorization': `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'WhyOps-Proxy/1.0',
    };

    if (isStreaming) {
      // Handle streaming response
      return stream(c, async (stream) => {
        const response = await fetch(openaiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const error = await response.text();
          logger.error({ status: response.status, error }, 'OpenAI API error');
          
          // Send error to analyse service (non-blocking)
          sendToAnalyse({
            eventType: 'llm_call',
            threadId,
            spanId,
            userId: auth.userId,
            providerId: auth.providerId,
            provider: 'openai',
            model: requestBody.model,
            messages: requestBody.messages,
            error: error,
            latencyMs: Date.now() - startTime,
          }).catch(err => logger.error({ err }, 'Failed to send error to analyse'));
          
          await stream.write(JSON.stringify({ error: 'Provider API error', details: error }));
          return;
        }

        // Collect chunks for logging
        const chunks: any[] = [];
        let accumulatedResponse: any = {
          id: '',
          object: 'chat.completion.chunk',
          created: 0,
          model: requestBody.model,
          choices: [{ delta: { role: 'assistant', content: '' }, index: 0, finish_reason: null }],
        };

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            
            // Parse SSE format
            const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '));
            
            for (const line of lines) {
              const data = line.replace('data: ', '').trim();
              
              if (data === '[DONE]') {
                await stream.write(`data: [DONE]\n\n`);
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                chunks.push(parsed);
                
                // Accumulate content
                if (parsed.choices?.[0]?.delta?.content) {
                  accumulatedResponse.choices[0].delta.content += parsed.choices[0].delta.content;
                }
                if (parsed.choices?.[0]?.finish_reason) {
                  accumulatedResponse.choices[0].finish_reason = parsed.choices[0].finish_reason;
                }
                if (parsed.id) {
                  accumulatedResponse.id = parsed.id;
                }
                if (parsed.created) {
                  accumulatedResponse.created = parsed.created;
                }
                
                // Forward to client
                await stream.write(`data: ${data}\n\n`);
              } catch (e) {
                // Skip invalid JSON
                logger.warn({ line }, 'Failed to parse SSE chunk');
              }
            }
          }

          // Send to analyse service (non-blocking)
          const latencyMs = Date.now() - startTime;
          sendToAnalyse({
            eventType: 'llm_call',
            threadId,
            spanId,
            userId: auth.userId,
            providerId: auth.providerId,
            provider: 'openai',
            model: requestBody.model,
            systemPrompt: requestBody.messages?.[0]?.role === 'system' ? requestBody.messages[0].content : undefined,
            messages: requestBody.messages,
            tools: requestBody.tools,
            temperature: requestBody.temperature,
            maxTokens: requestBody.max_tokens,
            response: {
              content: accumulatedResponse.choices[0].delta.content,
              finishReason: accumulatedResponse.choices[0].finish_reason,
            },
            latencyMs,
          }).catch(err => logger.error({ err }, 'Failed to send to analyse'));

          logger.info({ threadId, latencyMs, chunksCount: chunks.length }, 'Streaming completed');
          
        } finally {
          reader.releaseLock();
        }
      });
    } else {
      // Handle non-streaming response
      const response = await fetch(openaiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(env.PROXY_TIMEOUT_MS),
      });

      const latencyMs = Date.now() - startTime;
      const responseData = await response.json() as {
        choices?: Array<{
          message?: {
            content?: string;
            tool_calls?: any;
          };
          finish_reason?: string;
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
        [key: string]: any;
      };

      if (!response.ok) {
        logger.error({ status: response.status, responseData }, 'OpenAI API error');
        
        // Send error to analyse service (non-blocking)
        sendToAnalyse({
          eventType: 'llm_call',
          threadId,
          spanId,
          userId: auth.userId,
          providerId: auth.providerId,
          provider: 'openai',
          model: requestBody.model,
          messages: requestBody.messages,
          error: JSON.stringify(responseData),
          latencyMs,
        }).catch(err => logger.error({ err }, 'Failed to send error to analyse'));
        
        return c.json(responseData, response.status as any);
      }

      // Send to analyse service (non-blocking)
      sendToAnalyse({
        eventType: 'llm_call',
        threadId,
        spanId,
        userId: auth.userId,
        providerId: auth.providerId,
        provider: 'openai',
        model: requestBody.model,
        systemPrompt: requestBody.messages?.[0]?.role === 'system' ? requestBody.messages[0].content : undefined,
        messages: requestBody.messages,
        tools: requestBody.tools,
        temperature: requestBody.temperature,
        maxTokens: requestBody.max_tokens,
        response: {
          content: responseData.choices?.[0]?.message?.content,
          toolCalls: responseData.choices?.[0]?.message?.tool_calls,
          finishReason: responseData.choices?.[0]?.finish_reason,
        },
        usage: responseData.usage &&
          responseData.usage.prompt_tokens !== undefined &&
          responseData.usage.completion_tokens !== undefined &&
          responseData.usage.total_tokens !== undefined ? {
          promptTokens: responseData.usage.prompt_tokens,
          completionTokens: responseData.usage.completion_tokens,
          totalTokens: responseData.usage.total_tokens,
        } : undefined,
        latencyMs,
      }).catch(err => logger.error({ err }, 'Failed to send to analyse'));

      logger.info({ threadId, latencyMs, model: requestBody.model }, 'Request completed');

      // Return response to client
      return c.json(responseData);
    }
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    logger.error({ error, threadId }, 'Request failed');

    // Send error to analyse service (non-blocking)
    sendToAnalyse({
      eventType: 'llm_call',
      threadId,
      spanId,
      userId: auth.userId,
      providerId: auth.providerId,
      provider: 'openai',
      model: requestBody.model,
      messages: requestBody.messages,
      error: error.message,
      latencyMs,
    }).catch(err => logger.error({ err }, 'Failed to send error to analyse'));

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
