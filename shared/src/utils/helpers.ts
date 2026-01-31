import crypto from 'crypto';
import { nanoid } from 'nanoid';

/**
 * Generate a secure API key with prefix
 */
export function generateApiKey(prefix: string = 'whyops'): string {
  const randomPart = nanoid(32);
  return `${prefix}_${randomPart}`;
}

/**
 * Hash API key for storage
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Generate a thread ID
 */
export function generateThreadId(): string {
  return `thread_${nanoid(16)}`;
}

/**
 * Generate a span ID
 */
export function generateSpanId(): string {
  return `span_${nanoid(16)}`;
}

/**
 * Validate API key format
 */
export function validateApiKeyFormat(apiKey: string, prefix: string = 'whyops'): boolean {
  const regex = new RegExp(`^${prefix}_[A-Za-z0-9_-]{32}$`);
  return regex.test(apiKey);
}

/**
 * Redact sensitive data from objects
 */
export function redactSensitive<T extends Record<string, any>>(
  obj: T,
  fieldsToRedact: string[] = ['password', 'apiKey', 'api_key', 'secret', 'token']
): T {
  const redacted = { ...obj };
  
  for (const key in redacted) {
    if (fieldsToRedact.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      redacted[key] = '[REDACTED]' as T[Extract<keyof T, string>];
    } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redactSensitive(redacted[key], fieldsToRedact);
    }
  }
  
  return redacted;
}

/**
 * Parse database URL to connection config
 */
export function parseDatabaseUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port) || 5432,
    database: parsed.pathname.slice(1),
    username: parsed.username,
    password: parsed.password,
  };
}
