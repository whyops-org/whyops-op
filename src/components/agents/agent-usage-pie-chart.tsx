"use client";

import { useMemo } from "react";

import { Card } from "@/components/ui/card";
import { EmptyStateSimple } from "@/components/ui/empty-state-simple";
import { Spinner } from "@/components/ui/spinner";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AGENT_USAGE_CARD_SUBTITLE,
  AGENT_USAGE_CARD_TITLE,
  AGENT_USAGE_CHART_COLORS,
  AGENT_USAGE_COUNT_OPTIONS,
  AGENT_USAGE_EMPTY_DESCRIPTION,
  AGENT_USAGE_EMPTY_TITLE,
  DEFAULT_AGENT_USAGE_COUNT,
} from "@/constants/dashboard";
import { PieChart as PieChartIcon } from "lucide-react";
import { Cell, Pie, PieChart as RechartsPieChart } from "recharts";

interface AgentUsagePieChartProps {
  data?: Record<string, number> | null;
  agentCount?: number;
  onAgentCountChange?: (count: number) => void;
  isLoading?: boolean;
}

export function AgentUsagePieChart({
  data,
  agentCount = DEFAULT_AGENT_USAGE_COUNT,
  onAgentCountChange,
  isLoading = false,
}: AgentUsagePieChartProps) {
  const chartData = useMemo(() => {
    if (!data) return [];

    return Object.entries(data)
      .map(([name, value]) => ({
        name,
        value: typeof value === "number" ? value : Number(value),
      }))
      .filter((entry) => Number.isFinite(entry.value) && entry.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, agentCount);
  }, [data, agentCount]);

  const chartConfig = useMemo(() => {
    return chartData.reduce<ChartConfig>((acc, entry) => {
      acc[entry.name] = {
        label: entry.name,
      };
      return acc;
    }, {});
  }, [chartData]);

  const hasData = chartData.length > 0;

  const handleAgentCountChange = (value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    onAgentCountChange?.(parsed);
  };

  return (
    <Card className="gap-4 border-border/40 bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {AGENT_USAGE_CARD_TITLE}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {AGENT_USAGE_CARD_SUBTITLE}
          </p>
        </div>
        <Select
          value={agentCount.toString()}
          onValueChange={handleAgentCountChange}
        >
          <SelectTrigger className="h-8 w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGENT_USAGE_COUNT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value.toString()}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="h-52 w-full flex items-center justify-center">
          <Spinner className="h-8 w-8 border-2 text-primary" />
        </div>
      ) : !hasData ? (
        <div className="h-52 w-full flex items-center justify-center border border-dashed border-border/30">
          <EmptyStateSimple
            title={AGENT_USAGE_EMPTY_TITLE}
            description={AGENT_USAGE_EMPTY_DESCRIPTION}
            icon={PieChartIcon}
            className="py-0"
          />
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="h-52 w-full">
          <RechartsPieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent nameKey="name" />}
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={45}
              outerRadius={80}
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={1}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`${entry.name}-${index}`}
                  fill={AGENT_USAGE_CHART_COLORS[index % AGENT_USAGE_CHART_COLORS.length]}
                />
              ))}
            </Pie>
          </RechartsPieChart>
        </ChartContainer>
      )}
    </Card>
  );
}
