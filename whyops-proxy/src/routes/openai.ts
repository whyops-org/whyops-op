import env from '@whyops/shared/env';
import { createServiceLogger } from '@whyops/shared/logger';
import { generateSpanId, generateThreadId, decodeSignature, encodeSignature, stripSignature } from '@whyops/shared/utils';
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
  
  // 1. Try to find traceId from Headers
  let traceId = c.req.header('X-Thread-ID');

  // 2. If not found, try to extract hidden signature from the last assistant message
  if (!traceId && requestBody.messages?.length > 0) {
    // Iterate backwards to find the last assistant message
    for (let i = requestBody.messages.length - 1; i >= 0; i--) {
      const msg = requestBody.messages[i];
      if (msg.role === 'assistant' && msg.content) {
        const extractedId = decodeSignature(msg.content);
        if (extractedId) {
          traceId = extractedId;
          logger.debug({ traceId }, 'Extracted traceId from invisible signature');
          break;
        }
      }
    }
  }

  // 3. Fallback to generating new trace if not provided or found
  if (!traceId) {
    traceId = generateThreadId();
  }

  // Generate a distinct span ID for this interaction request
  const requestSpanId = generateSpanId();

  // CLEANUP: Strip signatures from history before sending to OpenAI
  // This is crucial so the LLM doesn't see the hidden characters
  if (requestBody.messages) {
    requestBody.messages = requestBody.messages.map((msg: any) => {
      if (typeof msg.content === 'string') {
        return { ...msg, content: stripSignature(msg.content) };
      }
      return msg;
    });
  }

  logger.info({
    model: requestBody.model,
    stream: isStreaming,
    traceId,
  }, 'OpenAI request received');

  // ... (Send Request Event logic remains same) ...
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

    // Prepare the invisible signature to inject into the response
    const signature = encodeSignature(traceId);

    if (isStreaming) {
      return stream(c, async (stream) => {
        const response = await fetch(openaiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          // ... error handling ...
          const error = await response.text();
          logger.error({ status: response.status, error }, 'OpenAI API error');
          
          sendToAnalyse({
            traceId: traceId!, // Assertion as we ensure it exists
            spanId: generateSpanId(),
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
        let signatureSent = false;

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
                // Inject signature in the final chunk (or as a separate chunk before DONE)
                if (!signatureSent) {
                   const signatureChunk = {
                     id: accumulatedState.id || "gen-signature",
                     object: "chat.completion.chunk",
                     created: Date.now(),
                     model: requestBody.model,
                     choices: [{
                       index: 0,
                       delta: { content: signature }, // Inject invisible signature
                       finish_reason: null
                     }]
                   };
                   await stream.write(`data: ${JSON.stringify(signatureChunk)}\n\n`);
                   signatureSent = true;
                }

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

          // ... (Send Response Event logic) ...
          sendToAnalyse({
            traceId: traceId!,
            spanId: generateSpanId(),
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
      const responseData = await response.json() as any;

      if (!response.ok) {
        // ... error handling ...
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

      // Inject signature into response content
      if (responseData.choices && responseData.choices[0] && responseData.choices[0].message) {
        // 1. Inject Invisible Signature into Content
        if (responseData.choices[0].message.content) {
          responseData.choices[0].message.content += signature;
        }

        // 2. Inject Trace ID into Tool Call Arguments (Non-Streaming)
        if (responseData.choices[0].message.tool_calls) {
          try {
            responseData.choices[0].message.tool_calls = responseData.choices[0].message.tool_calls.map((toolCall: any) => {
              if (toolCall.function && toolCall.function.arguments) {
                const args = JSON.parse(toolCall.function.arguments);
                args._whyops_trace_id = traceId; // Inject Trace ID
                toolCall.function.arguments = JSON.stringify(args);
              }
              return toolCall;
            });
          } catch (e) {
            logger.warn({ error: e }, 'Failed to inject traceId into tool calls');
          }
        }
      }

      const parsedResponse = OpenAIParser.parseResponse(responseData);
      
      // Strip signature from content before saving to DB
      if (parsedResponse.content) {
        parsedResponse.content = stripSignature(parsedResponse.content);
      }

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
    // ... error handling ...
    const latencyMs = Date.now() - startTime;
    sendToAnalyse({
      traceId: traceId!,
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

// Other OpenAI endpoints can be added here (embeddings, images, etc.)

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

export default app;
