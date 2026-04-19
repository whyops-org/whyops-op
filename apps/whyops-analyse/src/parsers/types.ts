export interface TraceMetadata {
  model?: string;
  systemMessage?: string;
  tools?: any;
}

export interface MetadataParser {
  extract(content: any, metadata: any): TraceMetadata;
}
