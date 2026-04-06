/**
 * Compressed event payload helpers for Phase 4 storage optimization.
 *
 * The events_payload column on traces stores a brotli-compressed JSON array of
 * all normalized events for the trace. It is a lazy read cache:
 *   - Built on first thread detail read (cache miss).
 *   - Invalidated (set to NULL) whenever a new event is written.
 *   - Subsequent reads decompress and return in ~1ms.
 *
 * Uses Node.js built-in zlib (no external deps). Brotli at quality 6 gives a
 * good balance of speed and compression ratio for JSON payloads.
 */

import { brotliCompressSync, brotliDecompressSync, constants } from 'zlib';

export interface PayloadEvent {
  id: string;
  sid: number;         // stepId
  psid?: number;       // parentStepId
  spid?: string;       // spanId
  t: string;           // eventType
  ts: string;          // timestamp ISO string
  c: unknown;          // normalized content
  model?: string;
  pt?: number;         // promptTokens
  ct?: number;         // completionTokens
  crt?: number;        // cacheReadTokens
  cwt?: number;        // cacheWriteTokens
  lat?: number;        // latencyMs
  fr?: string;         // finishReason
}

const BROTLI_OPTIONS = {
  params: { [constants.BROTLI_PARAM_QUALITY]: 6 },
};

export function compressPayload(events: PayloadEvent[]): Buffer {
  return brotliCompressSync(JSON.stringify(events), BROTLI_OPTIONS);
}

export function decompressPayload(data: Buffer): PayloadEvent[] {
  return JSON.parse(brotliDecompressSync(data).toString('utf8')) as PayloadEvent[];
}

/**
 * Convert a raw LLMEvent DB row (with typed columns from Phase 2) to a PayloadEvent.
 */
export function toPayloadEvent(row: {
  id: string;
  stepId: number;
  parentStepId?: number;
  spanId?: string;
  eventType: string;
  timestamp: Date;
  content?: unknown;
  metadata?: Record<string, unknown>;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  latencyMs?: number;
  finishReason?: string;
}): PayloadEvent {
  return {
    id: row.id,
    sid: row.stepId,
    psid: row.parentStepId,
    spid: row.spanId,
    t: row.eventType,
    ts: row.timestamp.toISOString(),
    c: row.content,
    model: row.model ?? (row.metadata?.model as string | undefined),
    pt: row.promptTokens,
    ct: row.completionTokens,
    crt: row.cacheReadTokens,
    cwt: row.cacheWriteTokens,
    lat: row.latencyMs ?? (row.metadata?.latencyMs as number | undefined),
    fr: row.finishReason,
  };
}
