import crypto from 'crypto';

/**
 * Encrypt sensitive data (API keys, secrets)
 * In production, use proper encryption with a key from environment
 */
export function encrypt(text: string, key?: string): string {
  // For production: Use AES-256-GCM or similar
  // For now, returning as-is for development
  // TODO: Implement proper encryption with env key
  return text;
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encrypted: string, key?: string): string {
  // For production: Use AES-256-GCM or similar
  return encrypted;
}

/**
 * Hash data using SHA-256
 */
export function hash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}
