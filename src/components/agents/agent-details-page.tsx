"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AgentDetailHeader } from "@/components/agents/agent-detail-header";
import { AgentDetailStats } from "@/components/agents/agent-detail-stats";
import { AgentTraceTimeline } from "@/components/agents/agent-trace-timeline";
import { RecentTracesTable } from "@/components/agents/recent-traces-table";
import { useAgentsStore } from "@/stores/agentsStore";
import { useConfigStore } from "@/stores/configStore";

export function AgentDetailsPage() {
  const params = useParams();
  const agentId = params.agentId as string;

  const { fetchAgentById, currentAgent, isLoading, isRefetching } = useAgentsStore();
  const config = useConfigStore((state) => state.config);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (config?.analyseBaseUrl && agentId) {
      fetchAgentById(agentId, 7).catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load agent");
      });
    }
  }, [config?.analyseBaseUrl, agentId, fetchAgentById]);

  const handlePeriodChange = (period: number) => {
    if (agentId) {
      fetchAgentById(agentId, period, true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !currentAgent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">
          {error || "Agent not found"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <AgentDetailHeader agent={currentAgent} />
      <AgentDetailStats agent={currentAgent} />
      <AgentTraceTimeline
        successPercentage={currentAgent.successPercentage as Record<string, number> | undefined}
        successRatePeriod={currentAgent.successRatePeriod}
        onPeriodChange={handlePeriodChange}
        isLoading={isRefetching}
      />
      <RecentTracesTable agentId={agentId} />
    </div>
  );
}
