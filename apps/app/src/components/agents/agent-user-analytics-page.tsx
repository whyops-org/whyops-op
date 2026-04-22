"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { AgentDetailHeader } from "@/components/agents/agent-detail-header";
import { AgentDetailStats } from "@/components/agents/agent-detail-stats";
import { AgentTraceCountTimeline } from "@/components/agents/agent-trace-count-timeline";
import { AgentTraceTimeline } from "@/components/agents/agent-trace-timeline";
import { AgentUserScope } from "@/components/agents/agent-user-scope";
import { RecentTracesTable } from "@/components/agents/recent-traces-table";
import { Spinner } from "@/components/ui/spinner";
import { DEFAULT_TIMELINE_PERIOD } from "@/constants/agent-timelines";
import { useAgentsStore } from "@/stores/agentsStore";
import { useConfigStore } from "@/stores/configStore";

export function AgentUserAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.agentId as string;
  const externalUserId = decodeURIComponent(params.externalUserId as string);

  const { fetchAgentById, currentAgent, isLoading } = useAgentsStore();
  const config = useConfigStore((state) => state.config);
  const [error, setError] = useState<string | null>(null);
  const [successRatePeriod, setSuccessRatePeriod] = useState(DEFAULT_TIMELINE_PERIOD);
  const [traceCountPeriod, setTraceCountPeriod] = useState(DEFAULT_TIMELINE_PERIOD);
  const [isSuccessRateLoading, setIsSuccessRateLoading] = useState(false);
  const [isTraceCountLoading, setIsTraceCountLoading] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  useEffect(() => {
    if (config?.analyseBaseUrl && agentId && externalUserId) {
      fetchAgentById(
        agentId,
        DEFAULT_TIMELINE_PERIOD,
        DEFAULT_TIMELINE_PERIOD,
        false,
        externalUserId
      ).catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load user analytics");
      }).finally(() => {
        setHasAttemptedLoad(true);
      });
    }
  }, [agentId, config?.analyseBaseUrl, externalUserId, fetchAgentById]);

  const handleSuccessRatePeriodChange = (period: number) => {
    setSuccessRatePeriod(period);
    setIsSuccessRateLoading(true);
    fetchAgentById(agentId, period, traceCountPeriod, true, externalUserId)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load user analytics");
      })
      .finally(() => {
        setIsSuccessRateLoading(false);
      });
  };

  const handleTraceCountPeriodChange = (period: number) => {
    setTraceCountPeriod(period);
    setIsTraceCountLoading(true);
    fetchAgentById(agentId, successRatePeriod, period, true, externalUserId)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load user analytics");
      })
      .finally(() => {
        setIsTraceCountLoading(false);
      });
  };

  const shouldShowInitialLoader =
    !hasAttemptedLoad || isLoading || (config?.analyseBaseUrl && !currentAgent && !error);

  if (shouldShowInitialLoader) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner className="h-8 w-8 border-2 text-primary" />
      </div>
    );
  }

  if (error || !currentAgent) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{error || "User analytics not found"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6 lg:p-8">
      <AgentDetailHeader agent={currentAgent} />
      <AgentUserScope
        externalUserId={externalUserId}
        actionLabel="Back to agent"
        onAction={() => router.push(`/agents/${agentId}`)}
      />
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
      <RecentTracesTable
        agentId={agentId}
        externalUserId={externalUserId}
        onClearExternalUserId={() => router.push(`/agents/${agentId}`)}
      />
    </div>
  );
}
