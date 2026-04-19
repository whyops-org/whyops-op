"use client";

import { useEffect, useState } from "react";

import { AgentDetailHeader } from "@/components/agents/agent-detail-header";
import { AgentDetailStats } from "@/components/agents/agent-detail-stats";
import { AgentTraceCountTimeline } from "@/components/agents/agent-trace-count-timeline";
import { AgentTraceTimeline } from "@/components/agents/agent-trace-timeline";
import { RecentTracesTable } from "@/components/agents/recent-traces-table";
import { UserDistributionTable } from "@/components/agents/user-distribution-table";
import { Spinner } from "@/components/ui/spinner";
import { DEFAULT_TIMELINE_PERIOD } from "@/constants/agent-timelines";
import { useAgentsStore } from "@/stores/agentsStore";
import { useConfigStore } from "@/stores/configStore";

interface AgentDetailsPageContentProps {
  agentId: string;
}

export function AgentDetailsPageContent({ agentId }: AgentDetailsPageContentProps) {
  const { fetchAgentById, currentAgent, isLoading } = useAgentsStore();
  const config = useConfigStore((state) => state.config);
  const [error, setError] = useState<string | null>(null);
  const [successRatePeriod, setSuccessRatePeriod] = useState(DEFAULT_TIMELINE_PERIOD);
  const [traceCountPeriod, setTraceCountPeriod] = useState(DEFAULT_TIMELINE_PERIOD);
  const [isSuccessRateLoading, setIsSuccessRateLoading] = useState(false);
  const [isTraceCountLoading, setIsTraceCountLoading] = useState(false);

  useEffect(() => {
    if (config?.analyseBaseUrl && agentId) {
      fetchAgentById(
        agentId,
        DEFAULT_TIMELINE_PERIOD,
        DEFAULT_TIMELINE_PERIOD
      ).catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load agent");
      });
    }
  }, [config?.analyseBaseUrl, agentId, fetchAgentById]);

  const handleSuccessRatePeriodChange = (period: number) => {
    if (agentId) {
      setSuccessRatePeriod(period);
      setIsSuccessRateLoading(true);
      fetchAgentById(agentId, period, traceCountPeriod, true)
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to load agent");
        })
        .finally(() => {
          setIsSuccessRateLoading(false);
        });
    }
  };

  const handleTraceCountPeriodChange = (period: number) => {
    if (agentId) {
      setTraceCountPeriod(period);
      setIsTraceCountLoading(true);
      fetchAgentById(agentId, successRatePeriod, period, true)
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to load agent");
        })
        .finally(() => {
          setIsTraceCountLoading(false);
        });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8 border-2 text-primary" />
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
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-full lg:flex-1">
          <AgentTraceTimeline
            successPercentage={currentAgent.successPercentage as Record<string, number> | undefined}
            successRatePeriod={successRatePeriod}
            onPeriodChange={handleSuccessRatePeriodChange}
            isLoading={isSuccessRateLoading || isLoading}
          />
        </div>
        <div className="w-full lg:flex-1">
          <AgentTraceCountTimeline
            traceCounts={currentAgent.traceCounts as Record<string, number> | undefined}
            traceCountPeriod={traceCountPeriod}
            onPeriodChange={handleTraceCountPeriodChange}
            isLoading={isTraceCountLoading || isLoading}
          />
        </div>
      </div>
      <RecentTracesTable agentId={agentId} />
      <UserDistributionTable agentId={agentId} />
    </div>
  );
}
