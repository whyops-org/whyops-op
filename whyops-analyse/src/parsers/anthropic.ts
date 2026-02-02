import { MetadataParser, TraceMetadata } from './types';

export class AnthropicParser implements MetadataParser {
  extract(content: any, metadata: any): TraceMetadata {
    const result: TraceMetadata = {};

    // 1. Model
    if (metadata?.model) {
      result.model = metadata.model;
    } else if (content?.model) {
      result.model = content.model;
    }

    // 2. System Message (Anthropic top-level 'system' field)
    if (content?.system) {
      result.systemMessage = content.system;
    } else if (metadata?.system) {
        result.systemMessage = metadata.system;
    }

    // 3. Tools (Anthropic 'tools' field)
    if (content?.tools) {
      result.tools = content.tools;
    } else if (metadata?.tools) {
        result.tools = metadata.tools;
    }

    return result;
  }
}
