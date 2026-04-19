import type { NormalizedEvent, NormalizedMessage } from './format-heuristics';

const ROLE_KEYS = ['role', 'speaker', 'author', 'from', 'actor', 'sender', 'kind', 'type'];
const TEXT_KEYS = ['content', 'text', 'message', 'response', 'output', 'result', 'input', 'value', 'body', 'payload'];
const MAX_DEPTH = 8;
const MAX_VISITS = 2_000;

type Role = NormalizedMessage['role'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRole(value: unknown): Role | null {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase();
  if (normalized.includes('system') || normalized.includes('developer')) return 'system';
  if (normalized.includes('assistant') || normalized.includes('agent') || normalized.includes('ai') || normalized.includes('bot') || normalized.includes('model')) return 'assistant';
  if (normalized.includes('tool') || normalized.includes('function')) return 'tool';
  if (normalized.includes('user') || normalized.includes('human') || normalized.includes('customer') || normalized.includes('client')) return 'user';
  return null;
}

function extractText(value: unknown, depth = 0): string {
  if (depth > 3 || value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => extractText(item, depth + 1))
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  if (!isRecord(value)) return '';

  for (const key of TEXT_KEYS) {
    if (!(key in value)) continue;
    const text = extractText(value[key], depth + 1);
    if (text) return text;
  }

  if ('arguments' in value && typeof value.arguments === 'string') {
    return value.arguments.trim();
  }

  return '';
}

function extractRole(record: Record<string, unknown>): Role | null {
  for (const key of ROLE_KEYS) {
    const role = normalizeRole(record[key]);
    if (role) return role;
  }
  return null;
}

function toEvents(messages: NormalizedMessage[]): NormalizedEvent[] {
  return messages.map((message, index) => {
    const eventType =
      message.role === 'user'
        ? 'user_message'
        : message.role === 'tool'
          ? 'tool_call_response'
          : 'llm_response';

    return {
      id: `s${index + 1}`,
      stepId: index + 1,
      eventType,
      timestamp: new Date(Date.now() + index * 1000).toISOString(),
      content: eventType === 'llm_response' ? { content: message.content } : message.content,
    };
  });
}

export function extractLooseConversation(input: unknown): { messages: NormalizedMessage[]; events: NormalizedEvent[] } | null {
  const messages: NormalizedMessage[] = [];
  const seen = new WeakSet<object>();
  let visits = 0;

  function visit(value: unknown, inheritedRole: Role | null, depth: number): void {
    if (depth > MAX_DEPTH || visits > MAX_VISITS || value === null || value === undefined) return;
    if (typeof value !== 'object') return;
    if (seen.has(value as object)) return;
    seen.add(value as object);
    visits += 1;

    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, inheritedRole, depth + 1));
      return;
    }

    const record = value as Record<string, unknown>;
    const role = extractRole(record) ?? inheritedRole;
    const text = extractText(record);

    if (role && text) {
      messages.push({ role, content: text });
      return;
    }

    Object.values(record).forEach((entry) => visit(entry, role, depth + 1));
  }

  visit(input, null, 0);

  const filtered = messages.filter((message) => message.content.trim().length > 0);
  if (filtered.length < 2) return null;

  const distinctRoles = new Set(filtered.map((message) => message.role));
  if (!distinctRoles.has('user') && !distinctRoles.has('assistant')) return null;

  return {
    messages: filtered,
    events: toEvents(filtered.filter((message) => message.role !== 'system')),
  };
}
