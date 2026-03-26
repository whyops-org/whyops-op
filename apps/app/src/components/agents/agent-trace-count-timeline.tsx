"use client";

import { BarChart3 } from "lucide-react";

import { AgentTimelineChart } from "@/components/agents/agent-timeline-chart";
import {
  TRACE_COUNT_EMPTY_DESCRIPTION,
  TRACE_COUNT_EMPTY_TITLE,
  TRACE_COUNT_TIMELINE_LABEL,
  TRACE_COUNT_TIMELINE_TITLE,
} from "@/constants/agent-timelines";

interface AgentTraceCountTimelineProps {
  traceCounts: Record<string, number> | undefined;
  traceCountPeriod: number | undefined;
  onPeriodChange?: (period: number) => void;
  isLoading?: boolean;
}

export function AgentTraceCountTimeline({
  traceCounts,
  traceCountPeriod,
  onPeriodChange,
  isLoading = false,
}: AgentTraceCountTimelineProps) {
  return (
    <AgentTimelineChart
      title={TRACE_COUNT_TIMELINE_TITLE}
      legendLabel={TRACE_COUNT_TIMELINE_LABEL}
      data={traceCounts}
      period={traceCountPeriod}
      onPeriodChange={onPeriodChange}
      isLoading={isLoading}
      emptyTitle={TRACE_COUNT_EMPTY_TITLE}
      emptyDescription={TRACE_COUNT_EMPTY_DESCRIPTION}
      chartColor="var(--primary)"
      legendColorClass="bg-accent"
      icon={BarChart3}
      variant="area"
    />
  );
}
