export type AnthropicRole = 'user' | 'assistant';

export type AnthropicSystemBlock =
  | { type: 'text'; text: string; cache_control?: { type: 'ephemeral'; ttl?: '5m' | '1h' } };

export type AnthropicContentBlock =
  | { type: 'text'; text: string; cache_control?: { type: 'ephemeral'; ttl?: string }; citations?: any[] }
  | { type: 'image'; source: { type: 'base64' | 'url'; media_type?: string; data?: string; url?: string }; cache_control?: { type: 'ephemeral'; ttl?: string } }
  | { type: 'document'; source: { type: 'base64' | 'text' | 'content' | 'url'; media_type?: string; data?: string; content?: any[]; url?: string }; title?: string; citations?: { enabled: boolean }; cache_control?: { type: 'ephemeral'; ttl?: string } }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, any>; cache_control?: { type: 'ephemeral'; ttl?: string }; caller?: any }
  | { type: 'server_tool_use'; id: string; name: string; input: Record<string, any>; caller?: any }
  | { type: 'tool_result'; tool_use_id: string; content: string | AnthropicContentBlock[]; is_error?: boolean; cache_control?: { type: 'ephemeral'; ttl?: string } }
  | { type: 'thinking'; thinking: string; signature: string }
  | { type: 'redacted_thinking'; data: string }
  | { type: 'search_result'; source: string; title?: string; content: Array<{ type: 'text'; text: string }>; citations?: { enabled: boolean }; cache_control?: { type: 'ephemeral'; ttl?: string } };

export interface AnthropicMessageInput {
  role: AnthropicRole;
  content: string | AnthropicContentBlock[];
}

export interface AnthropicToolDefinition {
  type?: 'custom' | 'web_search_20250305' | 'code_execution_20250522' | 'code_execution_20250825' | 'code_execution_20260120' | 'computer_20241022' | 'text_editor_20241022' | 'bash_20241022';
  name: string;
  description?: string;
  input_schema?: Record<string, any>;
  cache_control?: { type: 'ephemeral'; ttl?: string };
  strict?: boolean;
  max_uses?: number;
  allowed_domains?: string[];
  blocked_domains?: string[];
  user_location?: Record<string, any>;
  display_width_px?: number;
  display_height_px?: number;
  display_number?: number | null;
}

export interface AnthropicMessagesRequest {
  model: string;
  messages: AnthropicMessageInput[];
  max_tokens: number;
  system?: string | AnthropicSystemBlock[];
  stream?: boolean;
  temperature?: number;
  top_p?: number | null;
  top_k?: number | null;
  stop_sequences?: string[];
  tools?: AnthropicToolDefinition[];
  tool_choice?: { type: 'auto' | 'any' | 'tool' | 'none'; name?: string; disable_parallel_tool_use?: boolean };
  thinking?: { type: 'enabled' | 'disabled'; budget_tokens?: number };
  metadata?: { user_id?: string };
  citations?: { enabled: boolean };
  service_tier?: 'standard' | 'batch';
  [key: string]: any;
}

export interface AnthropicMessageResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  content: AnthropicContentBlock[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation?: Record<string, any> | null;
    server_tool_use?: Record<string, any> | null;
  };
  container?: any | null;
}

export type AnthropicStreamEvent =
  | { type: 'message_start'; message: AnthropicMessageResponse }
  | { type: 'message_delta'; delta: { stop_reason?: string; stop_sequence?: string | null }; usage?: AnthropicMessageResponse['usage'] }
  | { type: 'message_stop' }
  | { type: 'content_block_start'; index: number; content_block: AnthropicContentBlock }
  | { type: 'content_block_delta'; index: number; delta: { type: 'text_delta'; text: string } | { type: 'input_json_delta'; partial_json: string } | { type: 'thinking_delta'; thinking: string } | { type: 'signature_delta'; signature: string } | { type: 'citations_delta'; citation: any } }
  | { type: 'content_block_stop'; index: number }
  | { type: 'ping' }
  | { type: 'error'; error: { type: string; message: string } };
