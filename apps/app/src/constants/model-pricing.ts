/** Fallback model pricing used when live endpoint is unavailable */
export const MODEL_PRICING_FALLBACK = [
  { id: "gpt-4o", label: "GPT-4o", inputPer1M: 2.5, outputPer1M: 10.0, cacheReadPer1M: 1.25, cacheWrite5mPer1M: null, cacheWrite1hPer1M: null, contextWindow: 128_000 },
  { id: "gpt-4o-mini", label: "GPT-4o mini", inputPer1M: 0.15, outputPer1M: 0.6, cacheReadPer1M: 0.075, cacheWrite5mPer1M: null, cacheWrite1hPer1M: null, contextWindow: 128_000 },
  { id: "gpt-4-turbo", label: "GPT-4 Turbo", inputPer1M: 10.0, outputPer1M: 30.0, cacheReadPer1M: 5.0, cacheWrite5mPer1M: null, cacheWrite1hPer1M: null, contextWindow: 128_000 },
  { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", inputPer1M: 0.5, outputPer1M: 1.5, cacheReadPer1M: 0.25, cacheWrite5mPer1M: null, cacheWrite1hPer1M: null, contextWindow: 16_000 },
  { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", inputPer1M: 3.0, outputPer1M: 15.0, cacheReadPer1M: 0.3, cacheWrite5mPer1M: 3.75, cacheWrite1hPer1M: 6.0, contextWindow: 200_000 },
  { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku", inputPer1M: 0.8, outputPer1M: 4.0, cacheReadPer1M: 0.08, cacheWrite5mPer1M: 1.0, cacheWrite1hPer1M: 1.6, contextWindow: 200_000 },
  { id: "claude-3-opus-20240229", label: "Claude 3 Opus", inputPer1M: 15.0, outputPer1M: 75.0, cacheReadPer1M: 1.5, cacheWrite5mPer1M: 18.75, cacheWrite1hPer1M: 30.0, contextWindow: 200_000 },
  { id: "claude-3-haiku-20240307", label: "Claude 3 Haiku", inputPer1M: 0.25, outputPer1M: 1.25, cacheReadPer1M: 0.025, cacheWrite5mPer1M: 0.3125, cacheWrite1hPer1M: 0.5, contextWindow: 200_000 },
];
