import { createServiceLogger } from '@whyops/shared/logger';

const logger = createServiceLogger('proxy:parser:openai');

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

export class OpenAIParser {
  /**
   * Parse a non-streaming response from OpenAI
   */
  static parseResponse(data: any): ParsedResponse {
    return {
      content: data.choices?.[0]?.message?.content,
      toolCalls: data.choices?.[0]?.message?.tool_calls,
      finishReason: data.choices?.[0]?.finish_reason,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      id: data.id,
      created: data.created,
    };
  }

  /**
   * Parse a single SSE chunk from a streaming response
   */
  static parseStreamChunk(chunk: any, accumulated: ParsedResponse): ParsedResponse {
    const delta = chunk.choices?.[0]?.delta;
    const finishReason = chunk.choices?.[0]?.finish_reason;
    const usage = chunk.usage;

    // Clone accumulated response
    const result: ParsedResponse = { ...accumulated };

    // Update ID and Created if present
    if (chunk.id) result.id = chunk.id;
    if (chunk.created) result.created = chunk.created;

    // Accumulate content
    if (delta?.content) {
      result.content = (result.content || '') + delta.content;
    }

    // Accumulate tool calls (simplified for now, robust tool call merging is complex)
    if (delta?.tool_calls) {
      if (!result.toolCalls) result.toolCalls = [];
      // This is a simplified merge. In reality, tool_calls stream by index.
      // For MVP, we might just store the final result if possible or rely on the final object.
      // But usually simply appending isn't enough for tool calls.
      // For now, we will just pass through what we have or implement proper merging later if needed.
    }

    // Update finish reason
    if (finishReason) {
      result.finishReason = finishReason;
    }

    // Capture usage (usually in the last chunk)
    if (usage) {
      result.usage = {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      };
    }

    return result;
  }
  
  /**
   * Initial empty state for streaming accumulation
   */
  static getInitialStreamState(): ParsedResponse {
    return {
      content: '',
      toolCalls: undefined,
      finishReason: undefined,
      usage: undefined,
    };
  }
}
