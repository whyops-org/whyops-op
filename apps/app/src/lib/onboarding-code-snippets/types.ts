export interface CodeSnippetData {
  apiKey: string;
  providerSlug: string;
}

export interface CodeSnippetConfig {
  proxyBaseUrl: string;
  analyseBaseUrl: string;
}

export interface CodeSnippet {
  filename: string;
  code: string;
}

export type SnippetType = "proxy" | "events";
