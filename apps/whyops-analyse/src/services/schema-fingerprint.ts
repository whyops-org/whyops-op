import { createHash } from 'crypto';

/**
 * Recursively extracts "path:type" strings from any JSON object.
 * Arrays are represented as path[] — only the first element is sampled.
 * Max depth 6 to keep fingerprints small.
 */
export function extractPaths(obj: unknown, prefix = '', depth = 0): string[] {
  if (depth > 6) return [];

  if (obj === null || obj === undefined) {
    return prefix ? [`${prefix}:null`] : [];
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return prefix ? [`${prefix}[]:empty`] : [];
    return extractPaths(obj[0], `${prefix}[]`, depth + 1);
  }

  if (typeof obj !== 'object') {
    return prefix ? [`${prefix}:${typeof obj}`] : [];
  }

  const paths: string[] = [];
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    paths.push(...extractPaths(val, fullKey, depth + 1));
  }
  return paths;
}

/**
 * Returns a stable 16-char hex key for any JSON object's schema.
 * Two objects with the same structure (ignoring values) produce the same hash.
 */
export function hashSchema(obj: unknown): string {
  const paths = [...new Set(extractPaths(obj))].sort();
  return createHash('sha256').update(paths.join('\n')).digest('hex').slice(0, 16);
}

/**
 * Returns human-readable schema path list for use in LLM prompts.
 */
export function schemaPathsForPrompt(obj: unknown): string {
  const paths = [...new Set(extractPaths(obj))].sort();
  return paths.join('\n');
}
