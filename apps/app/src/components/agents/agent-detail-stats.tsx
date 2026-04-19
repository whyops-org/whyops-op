"use client";

import { Card } from "@/components/ui/card";
import type { Agent } from "@/types/global";
import { Activity, AlertTriangle, CheckCircle, Clock } from "lucide-react";

interface AgentDetailStatsProps {
  agent: Agent;
}

function deriveStatus(lastActive: string): "active" | "inactive" {
  const date = new Date(lastActive);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours < 24 ? "active" : "inactive";
}

function getSuccessPercentage(
  successPercentage: number | Record<string, number> | undefined
): number {
  if (!successPercentage) return 0;
  if (typeof successPercentage === "number") return successPercentage;

  const values = Object.values(successPercentage);
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return Math.round(sum / values.length);
}

export function AgentDetailStats({ agent }: AgentDetailStatsProps) {
  const status = deriveStatus(agent.lastActive);
  const successPercentage =
    typeof agent.successPercentage === "number"
      ? agent.successPercentage
      : getSuccessPercentage(agent.successPercentage);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Traces */}
      <Card className="bg-card border-border/30 p-6 relative overflow-hidden">
        <div className="flex items-start justify-between mb-4">
          <span className="text-sm font-medium text-muted-foreground">Total Traces</span>
          <Activity className="h-5 w-5 text-muted-foreground/50" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-foreground">
            {agent.traceCount?.toLocaleString() ?? 0}
          </span>
        </div>
      </Card>

      {/* Success Rate */}
      <Card className="bg-card border-border/30 p-6 relative overflow-hidden">
        <div className="flex items-start justify-between mb-4">
          <span className="text-sm font-medium text-muted-foreground">Success Rate</span>
          <CheckCircle className="h-5 w-5 text-muted-foreground/50" />
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-4xl font-bold text-primary">
            {successPercentage}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-sm bg-surface-2">
          <div
            className="h-full rounded-sm bg-primary transition-all duration-500 ease-in-out"
            style={{ width: `${successPercentage}%` }}
          />
        </div>
      </Card>

      {/* Last Active */}
      <Card className="bg-card border-border/30 p-6 relative overflow-hidden">
        <div className="flex items-start justify-between mb-4">
          <span className="text-sm font-medium text-muted-foreground">Last Active</span>
          <Clock className="h-5 w-5 text-muted-foreground/50" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-foreground">
            {agent.lastActive ? formatTimeAgo(agent.lastActive) : "Never"}
          </span>
        </div>
      </Card>

      {/* Status */}
      <Card className="bg-card border-border/30 p-6 relative overflow-hidden">
        <div className="flex items-start justify-between mb-4">
          <span className="text-sm font-medium text-muted-foreground">Status</span>
          <AlertTriangle className="h-5 w-5 text-muted-foreground/50" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-foreground capitalize">
            {status}
          </span>
        </div>
      </Card>
    </div>
  );
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
