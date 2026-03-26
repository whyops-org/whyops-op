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
};

function getUsage(event: TraceEvent): Usage | null {
  if (!event.metadata || typeof event.metadata !== "object") {
    return null;
  }
  const usage = (event.metadata as { usage?: Usage }).usage;
  return usage ?? null;
}

function normalizeUsage(usage: Usage): Required<Pick<Usage, "promptTokens" | "completionTokens" | "cachedTokens">> & { totalTokens?: number } {
  return {
    promptTokens: usage.promptTokens ?? usage.inputTokens ?? 0,
    completionTokens: usage.completionTokens ?? usage.outputTokens ?? 0,
    cachedTokens: usage.cachedTokens ?? 0,
    totalTokens: usage.totalTokens,
  };
}

function calculateCostForUsage(usage: Usage, rate: TraceCostRate): number {
  const normalized = normalizeUsage(usage);
  const hasSplitTokens = normalized.promptTokens > 0 || normalized.completionTokens > 0 || normalized.cachedTokens > 0;

  if (hasSplitTokens) {
    const inputCost = (normalized.promptTokens / TOKENS_PER_MILLION) * rate.inputTokenPricePerMillionToken;
    const outputCost = (normalized.completionTokens / TOKENS_PER_MILLION) * rate.outputTokenPricePerMillionToken;
    const cachedCost = (normalized.cachedTokens / TOKENS_PER_MILLION) * rate.cachedTokenPricePerMillionToken;
    return inputCost + outputCost + cachedCost;
  }

  if (normalized.totalTokens && normalized.totalTokens > 0) {
    const blendedRate = (rate.inputTokenPricePerMillionToken + rate.outputTokenPricePerMillionToken) / 2;
    return (normalized.totalTokens / TOKENS_PER_MILLION) * blendedRate;
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
