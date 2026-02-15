"use client";

import { useEffect, useCallback } from "react";

import { AgentsTable } from "@/components/agents/agents-table";
import { StatCard } from "@/components/agents/stat-card";
import { SuccessRateChart } from "@/components/agents/success-rate-chart";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { Activity, Clock, Plus, Settings, TrendingUp, Users } from "lucide-react";

import { useAgentsStore } from "@/stores/agentsStore";
import { useAgentsContext } from "@/components/agents/agents-provider";
import { useConfigStore } from "@/stores/configStore";
import { useDashboardStore } from "@/stores/dashboardStore";

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
  const { stats, chartData, fetchDashboardStats, setApiKey: setDashboardApiKey } = useDashboardStore();
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
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [setApiKey, setDashboardApiKey]);

  useEffect(() => {
    if (config?.analyseBaseUrl) {
      fetchDashboardStats();
    }
  }, [config?.analyseBaseUrl, fetchDashboardStats]);

  const handlePageChange = useCallback((page: number) => {
    fetchAgents(page, pagination.count);
  }, [fetchAgents, pagination.count]);

  const handleCountChange = useCallback((count: number) => {
    fetchAgents(1, count);
  }, [fetchAgents]);

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

  return (
    <div className="space-y-6 p-8">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Active State Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time monitoring for deployed autonomous agents
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="md" className="gap-2">
            <Settings className="h-4 w-4" />
            Configure View
          </Button>
          <Button variant="primary" size="md" className="gap-2">
            <Plus className="h-4 w-4" />
            Deploy Agent
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
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
          trend={{
            value: "+1.6%",
            isPositive: true,
          }}
          subtitle="vs previous week"
          icon={<TrendingUp className="h-6 w-6 text-primary" />}
        />
        <StatCard
          title="Avg Latency"
          value={stats?.avgLatency ?? "0ms"}
          trend={{
            value: "+0.4s",
            isPositive: false,
          }}
          subtitle="High load detected"
          icon={<Clock className="h-6 w-6 text-primary" />}
        />
      </div>

      {/* Chart */}
      <SuccessRateChart data={chartData} />

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
