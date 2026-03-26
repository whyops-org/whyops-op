"use client";

import { Activity } from "lucide-react";

import { AgentTimelineChart } from "@/components/agents/agent-timeline-chart";
import {
  SUCCESS_RATE_EMPTY_DESCRIPTION,
  SUCCESS_RATE_EMPTY_TITLE,
  SUCCESS_RATE_TIMELINE_LABEL,
  SUCCESS_RATE_TIMELINE_TITLE,
} from "@/constants/agent-timelines";

interface AgentTraceTimelineProps {
  successPercentage: Record<string, number> | undefined;
  successRatePeriod: number | undefined;
  onPeriodChange?: (period: number) => void;
  isLoading?: boolean;
}

export function AgentTraceTimeline({
  successPercentage,
  successRatePeriod,
  onPeriodChange,
  isLoading = false,
}: AgentTraceTimelineProps) {
  return (
    <AgentTimelineChart
      title={SUCCESS_RATE_TIMELINE_TITLE}
      legendLabel={SUCCESS_RATE_TIMELINE_LABEL}
      data={successPercentage}
      period={successRatePeriod}
      onPeriodChange={onPeriodChange}
      isLoading={isLoading}
      emptyTitle={SUCCESS_RATE_EMPTY_TITLE}
      emptyDescription={SUCCESS_RATE_EMPTY_DESCRIPTION}
      chartColor="var(--primary)"
      legendColorClass="bg-primary"
      icon={Activity}
    />
  );
}
