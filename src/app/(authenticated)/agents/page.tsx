"use client";

import { useEffect, useCallback } from "react";

import { AgentsTable } from "@/components/agents/agents-table";
import { AgentUsagePieChart } from "@/components/agents/agent-usage-pie-chart";
import { StatCard } from "@/components/agents/stat-card";
import { SuccessRateChart } from "@/components/agents/success-rate-chart";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Activity, Clock, TrendingUp, Users } from "lucide-react";

import { useAgentsStore } from "@/stores/agentsStore";
import { useAgentsContext } from "@/components/agents/agents-provider";
import { useConfigStore } from "@/stores/configStore";
import { useDashboardStore } from "@/stores/dashboardStore";

function formatPercentDelta(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;
  return `${rounded >= 0 ? "+" : ""}${rounded.toFixed(1)}%`;
}

function formatLatencyDelta(deltaMs: number): string {
  const abs = Math.abs(deltaMs);
  if (abs >= 1000) {
    const seconds = abs / 1000;
    return `${deltaMs >= 0 ? "+" : "-"}${seconds.toFixed(1)}s`;
  }
  return `${deltaMs >= 0 ? "+" : "-"}${Math.round(abs)}ms`;
}

export default function AgentsPage() {
  const {
    agents,
    isLoading,
    pagination,
    startPolling,
    stopPolling,
    setApiKey,
    setInitialAgents,
    fetchAgents
  } = useAgentsStore();
  const { initialAgents } = useAgentsContext();
  const {
    stats,
    chartData,
    agentUsage,
    agentUsageCount,
    isLoading: isDashboardLoading,
    fetchDashboardStats,
    setAgentUsageCount,
    setApiKey: setDashboardApiKey,
  } = useDashboardStore();
  const config = useConfigStore((state) => state.config);

  // Use initial agents from server, then fall back to store
  const displayAgents = agents.length > 0 ? agents : initialAgents;

  // Initialize store with server data
  useEffect(() => {
    if (initialAgents.length > 0 && agents.length === 0) {
      setInitialAgents(initialAgents);
    }
  }, [initialAgents, agents.length, setInitialAgents]);

  // Initialize API key from localStorage on mount
  useEffect(() => {
    const storedAgentsStore = localStorage.getItem("whyops-agents-store");
    if (storedAgentsStore) {
      try {
        const parsed = JSON.parse(storedAgentsStore);
        if (parsed.state?.apiKey) {
          setApiKey(parsed.state.apiKey);
          setDashboardApiKey(parsed.state.apiKey);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, [setApiKey, setDashboardApiKey]);

  useEffect(() => {
    if (config?.analyseBaseUrl) {
      fetchDashboardStats();
    }
  }, [config?.analyseBaseUrl, fetchDashboardStats, agentUsageCount]);

  const handlePageChange = useCallback((page: number) => {
    fetchAgents(page, pagination.count);
  }, [fetchAgents, pagination.count]);

  const handleCountChange = useCallback((count: number) => {
    fetchAgents(1, count);
  }, [fetchAgents]);

  const handleAgentUsageCountChange = useCallback((count: number) => {
    setAgentUsageCount(count);
  }, [setAgentUsageCount]);

  useEffect(() => {
    if (config?.analyseBaseUrl) {
      startPolling(30000);
    }

    return () => {
      stopPolling();
    };
  }, [config?.analyseBaseUrl, startPolling, stopPolling]);

  // Show empty state if no agents (and not loading)
  if (displayAgents.length === 0 && !isLoading) {
    return (
      <div className="min-h-screen">
        <EmptyState />
      </div>
    );
  }

  const successRateTrend =
    typeof stats?.successRateDelta === "number"
      ? {
          value: formatPercentDelta(stats.successRateDelta),
          isPositive: stats.successRateDelta >= 0,
        }
      : undefined;

  const avgLatencyTrend =
    typeof stats?.avgLatencyDeltaMs === "number"
      ? {
          value: formatLatencyDelta(stats.avgLatencyDeltaMs),
          isPositive: stats.avgLatencyDeltaMs <= 0,
        }
      : undefined;

  return (
    <div className="space-y-5 p-6 lg:p-7">
      {/* Page Header */}
      <div className="border-b border-border/40 pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Agents Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor performance and activity across deployed agents.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Agents"
          value={stats?.totalAgents.toLocaleString() ?? "0"}
          icon={<Users className="h-6 w-6 text-primary" />}
        />
        <StatCard
          title="Active Traces"
          value={(stats?.activeTraces ?? 0).toLocaleString()}
          icon={<Activity className="h-6 w-6 text-primary" />}
        />
        <StatCard
          title="Success Rate"
          value={`${stats?.successRate ?? 100}%`}
          trend={successRateTrend}
          subtitle="vs previous week"
          icon={<TrendingUp className="h-6 w-6 text-primary" />}
        />
        <StatCard
          title="Avg Latency"
          value={stats?.avgLatency ?? "0ms"}
          trend={avgLatencyTrend}
          subtitle="vs previous week"
          icon={<Clock className="h-6 w-6 text-primary" />}
        />
      </div>

      {/* Chart */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full lg:w-[320px] xl:w-[360px]">
          <AgentUsagePieChart
            data={agentUsage}
            agentCount={agentUsageCount}
            onAgentCountChange={handleAgentUsageCountChange}
            isLoading={isDashboardLoading}
          />
        </div>
        <div className="w-full lg:flex-1">
          <SuccessRateChart data={chartData} />
        </div>
      </div>

      {/* Agents Table */}
      <AgentsTable
        agents={displayAgents}
        pagination={pagination}
        isLoading={isLoading}
        onPageChange={handlePageChange}
        onCountChange={handleCountChange}
      />
    </div>
  );
}
