/**
 * Shared SDK config accessors.
 * Source of truth: packages/sdk/config.json
 * Generated constants: src/config.generated.ts
 */

import {
  DEFAULT_ANALYSE_URL,
  DEFAULT_PROXY_URL,
  ENDPOINTS,
  HEADERS,
  HTTP_TIMEOUT_MS,
  LOG_PREFIX,
  REQUIRED_METADATA_BY_EVENT,
  RETRY_DELAYS_MS,
  RETRYABLE_STATUS_CODES,
  SDK_VERSION,
} from './config.generated.js';

export {
  DEFAULT_ANALYSE_URL,
  DEFAULT_PROXY_URL,
  ENDPOINTS,
  HEADERS,
  HTTP_TIMEOUT_MS,
  LOG_PREFIX,
  REQUIRED_METADATA_BY_EVENT,
  RETRY_DELAYS_MS,
  SDK_VERSION,
};

export const RETRYABLE_STATUSES = new Set<number>(RETRYABLE_STATUS_CODES as readonly number[]);
