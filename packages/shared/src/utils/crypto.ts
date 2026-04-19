import { createHash } from 'crypto';

/**
 * Simple encryption/decryption utilities
 * Note: These are placeholder implementations. In production, use proper encryption.
 */

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'dev-key-change-in-production';

/**
 * Encrypt sensitive data
 */
export function encrypt(text: string): string {
  // For now, return base64 encoded (not secure - just for development)
  // TODO: Implement proper AES-256-GCM encryption
  return Buffer.from(text).toString('base64');
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encrypted: string): string {
  // For now, decode from base64
  // TODO: Implement proper decryption
  return Buffer.from(encrypted, 'base64').toString('utf-8');
}

/**
 * Hash data using SHA-256
 */
export function hash(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}
