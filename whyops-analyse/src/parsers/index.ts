import { Provider } from '@whyops/shared/models';
import { MetadataParser, TraceMetadata } from './types';
import { OpenAIParser } from './openai';
import { AnthropicParser } from './anthropic';

// Factory to get parser based on provider type
// We might need to fetch provider type from DB or pass it in event
export class ParserFactory {
  private static parsers: Record<string, MetadataParser> = {
    'openai': new OpenAIParser(),
    'anthropic': new AnthropicParser(),
  };

  static getParser(providerType: string): MetadataParser {
    return this.parsers[providerType.toLowerCase()] || this.parsers['openai']; // Default to OpenAI structure if unknown
  }
}
