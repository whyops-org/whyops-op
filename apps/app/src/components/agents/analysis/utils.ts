export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
}

export function formatMetricNumber(value: number | null | undefined, suffix = ""): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "N/A";
  }
  return `${value.toLocaleString()}${suffix}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  return `${value.toFixed(2)}%`;
}

const CHECKPOINT_STATUS_LABELS: Record<string, string> = {
  started: "Started",
  completed: "Completed",
  failed: "Failed",
  ready: "Ready",
  loaded: "Loaded",
};

export function formatAgentCheckpointCopy(
  checkpointKey: string,
  sequence: number
): { title: string; description: string } {
  const parts = checkpointKey
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);

  const lastToken = parts[parts.length - 1]?.toLowerCase();
  const statusLabel = lastToken && CHECKPOINT_STATUS_LABELS[lastToken]
    ? CHECKPOINT_STATUS_LABELS[lastToken]
    : "Updated";
  const pathTokens = statusLabel === "Updated" ? parts : parts.slice(0, -1);
  const label = pathTokens.length > 0
    ? pathTokens.map((token) => token.replace(/_/g, " ")).join(" / ")
    : "analysis";

  return {
    title: `${statusLabel}: ${label}`,
    description: `Checkpoint ${sequence}`,
  };
}
