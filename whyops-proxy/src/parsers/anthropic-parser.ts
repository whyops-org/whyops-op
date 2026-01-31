import { createServiceLogger } from '@whyops/shared/logger';

const logger = createServiceLogger('proxy:parser:anthropic');

export interface ParsedResponse {
  content?: string;
  toolCalls?: any[];
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  id?: string;
  created?: number;
}

export class AnthropicParser {
  /**
   * Parse a non-streaming response from Anthropic
   */
  static parseResponse(data: any): ParsedResponse {
    return {
      content: data.content?.[0]?.text, // Assumes text block is first
      toolCalls: data.content?.filter((c: any) => c.type === 'tool_use'),
      finishReason: data.stop_reason,
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      } : undefined,
      id: data.id,
      created: Date.now(), // Anthropic doesn't always send created timestamp in same format
    };
  }

  /**
   * Parse a single SSE event from a streaming response
   * Anthropic streaming is event-based (message_start, content_block_delta, etc.)
   */
  static parseStreamEvent(event: string, data: any, accumulated: ParsedResponse): ParsedResponse {
    const result: ParsedResponse = { ...accumulated };

    switch (event) {
      case 'message_start':
        if (data.message?.id) result.id = data.message.id;
        if (data.message?.usage) {
          // Initial input usage
          result.usage = {
            promptTokens: data.message.usage.input_tokens,
            completionTokens: 0,
            totalTokens: data.message.usage.input_tokens,
          };
        }
        break;

      case 'content_block_delta':
        if (data.delta?.type === 'text_delta') {
          result.content = (result.content || '') + data.delta.text;
        }
        break;

      case 'message_delta':
        if (data.delta?.stop_reason) {
          result.finishReason = data.delta.stop_reason;
        }
        if (data.usage) {
          // Update output usage
          const currentInput = result.usage?.promptTokens || 0;
          const output = data.usage.output_tokens;
          result.usage = {
            promptTokens: currentInput,
            completionTokens: output,
            totalTokens: currentInput + output,
          };
        }
        break;
        
      case 'message_stop':
        // Final event
        break;
    }

    return result;
  }

  static getInitialStreamState(): ParsedResponse {
    return {
      content: '',
      toolCalls: undefined,
      finishReason: undefined,
      usage: undefined,
    };
  }
}
