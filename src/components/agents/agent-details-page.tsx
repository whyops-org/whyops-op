"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AgentDetailHeader } from "@/components/agents/agent-detail-header";
import { AgentDetailStats } from "@/components/agents/agent-detail-stats";
import { AgentTraceCountTimeline } from "@/components/agents/agent-trace-count-timeline";
import { AgentTraceTimeline } from "@/components/agents/agent-trace-timeline";
import { AgentVersionConfigTab } from "@/components/agents/agent-version-config-tab";
import { AgentAnalysisTab } from "@/components/agents/analysis/AgentAnalysisTab";
import { AgentEvalsTab } from "@/components/agents/evals/AgentEvalsTab";
import { RecentTracesTable } from "@/components/agents/recent-traces-table";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_TIMELINE_PERIOD } from "@/constants/agent-timelines";
import { useAgentsStore } from "@/stores/agentsStore";
import { useConfigStore } from "@/stores/configStore";

export function AgentDetailsPage() {
  const params = useParams();
  const agentId = params.agentId as string;

  const { fetchAgentById, currentAgent, isLoading } = useAgentsStore();
  const config = useConfigStore((state) => state.config);
  const [error, setError] = useState<string | null>(null);
  const [successRatePeriod, setSuccessRatePeriod] = useState(DEFAULT_TIMELINE_PERIOD);
  const [traceCountPeriod, setTraceCountPeriod] = useState(DEFAULT_TIMELINE_PERIOD);
  const [isSuccessRateLoading, setIsSuccessRateLoading] = useState(false);
  const [isTraceCountLoading, setIsTraceCountLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  useEffect(() => {
    if (config?.analyseBaseUrl && agentId) {
      fetchAgentById(
        agentId,
        DEFAULT_TIMELINE_PERIOD,
        DEFAULT_TIMELINE_PERIOD
      ).catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load agent");
      }).finally(() => {
        setHasAttemptedLoad(true);
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

  const shouldShowInitialLoader =
    !hasAttemptedLoad || isLoading || (config?.analyseBaseUrl && !currentAgent && !error);

  if (shouldShowInitialLoader) {
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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full max-w-lg">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="evals">Evals</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="configuration">
          <AgentVersionConfigTab
            agentId={agentId}
            preferredVersionId={currentAgent.latestVersion?.id}
          />
        </TabsContent>

        <TabsContent value="analysis">
          <AgentAnalysisTab key={agentId} agentId={agentId} />
        </TabsContent>

        <TabsContent value="evals">
          <AgentEvalsTab key={agentId} agentId={agentId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
