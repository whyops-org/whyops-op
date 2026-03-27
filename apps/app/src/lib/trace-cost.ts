import type { TraceCostRate, TraceEvent } from "@/stores/traceDetailStore";

const TOKENS_PER_MILLION = 1_000_000;
const SMALL_COST_THRESHOLD = 0.01;

type Usage = {
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheWrite5mTokens?: number;
  cacheWrite1hTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
};

function getUsage(event: TraceEvent): Usage | null {
  if (!event.metadata || typeof event.metadata !== "object") {
    return null;
  }
  const usage = (event.metadata as { usage?: Usage }).usage;
  return usage ?? null;
}

function normalizeUsage(usage: Usage) {
  return {
    promptTokens: usage.promptTokens ?? usage.inputTokens ?? 0,
    completionTokens: usage.completionTokens ?? usage.outputTokens ?? 0,
    cacheWrite5mTokens: usage.cacheWrite5mTokens ?? 0,
    cacheWrite1hTokens: usage.cacheWrite1hTokens ?? 0,
    cacheCreationTokens: usage.cacheCreationTokens ?? 0,
    cacheReadTokens: usage.cacheReadTokens ?? usage.cachedTokens ?? 0,
    totalTokens: usage.totalTokens,
  };
}

function calculateCostForUsage(usage: Usage, rate: TraceCostRate): number {
  const n = normalizeUsage(usage);
  const hasSplitTokens = n.promptTokens > 0 || n.completionTokens > 0 || n.cacheReadTokens > 0 || n.cacheCreationTokens > 0;

  if (hasSplitTokens) {
    const cacheReadPrice = rate.cacheReadTokenPricePerMillionToken ?? rate.cachedTokenPricePerMillionToken ?? 0;
    const cache5mPrice = rate.cacheWrite5mTokenPricePerMillionToken ?? 0;
    const cache1hPrice = rate.cacheWrite1hTokenPricePerMillionToken ?? 0;

    // Prefer split TTL; if unavailable, attribute all creation tokens to 5m price
    const cache5m = n.cacheWrite5mTokens > 0 ? n.cacheWrite5mTokens : n.cacheCreationTokens;
    const cache1h = n.cacheWrite1hTokens;

    return (
      (n.promptTokens / TOKENS_PER_MILLION) * rate.inputTokenPricePerMillionToken +
      (n.completionTokens / TOKENS_PER_MILLION) * rate.outputTokenPricePerMillionToken +
      (cache5m / TOKENS_PER_MILLION) * cache5mPrice +
      (cache1h / TOKENS_PER_MILLION) * cache1hPrice +
      (n.cacheReadTokens / TOKENS_PER_MILLION) * cacheReadPrice
    );
  }

  if (n.totalTokens && n.totalTokens > 0) {
    const blendedRate = (rate.inputTokenPricePerMillionToken + rate.outputTokenPricePerMillionToken) / 2;
    return (n.totalTokens / TOKENS_PER_MILLION) * blendedRate;
  }

  return 0;
}

export function calculateTraceCost(events: TraceEvent[], rate?: TraceCostRate | null): {
  total: number;
  perEvent: Map<string, number>;
} {
  if (!rate) {
    return { total: 0, perEvent: new Map() };
  }

  let total = 0;
  const perEvent = new Map<string, number>();

  events.forEach((event) => {
    if (event.eventType !== "llm_response") {
      return;
    }
    const usage = getUsage(event);
    if (!usage) return;

    const cost = calculateCostForUsage(usage, rate);
    if (cost <= 0) return;

    perEvent.set(event.id, cost);
    total += cost;
  });

  return { total, perEvent };
}

export function formatCostUsd(cost: number): string {
  if (cost <= 0) return "$0.00";
  if (cost < SMALL_COST_THRESHOLD) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

export function getPrimaryCostRate(costs?: TraceCostRate[] | null): TraceCostRate | null {
  if (!costs || costs.length === 0) return null;
  return costs[0] ?? null;
}

/**
 * Get total cost from backend-computed value, falling back to event-based calculation.
 */
export function getTraceTotalCost(
  backendTotalCost: number | undefined,
  events: TraceEvent[],
  legacyCostRate?: TraceCostRate | null,
): number {
  if (typeof backendTotalCost === "number") return backendTotalCost;
  const { total } = calculateTraceCost(events, legacyCostRate);
  return total;
}
