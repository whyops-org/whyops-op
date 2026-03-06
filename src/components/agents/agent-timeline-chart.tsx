"use client";

import { useId, useMemo } from "react";

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
  AGENT_TIMELINE_PERIOD_OPTIONS,
  DEFAULT_TIMELINE_PERIOD,
} from "@/constants/agent-timelines";
import type { LucideIcon } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis } from "recharts";

interface AgentTimelineChartProps {
  title: string;
  legendLabel: string;
  data?: Record<string, number>;
  period?: number;
  onPeriodChange?: (period: number) => void;
  isLoading?: boolean;
  emptyTitle: string;
  emptyDescription: string;
  chartColor: string;
  legendColorClass: string;
  icon?: LucideIcon;
  variant?: "bar" | "area";
}

interface ChartDataPoint {
  day: string;
  value: number;
}

function formatTimelineData(data?: Record<string, number>): ChartDataPoint[] {
  if (!data) return [];

  return Object.entries(data)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, value]) => ({
      day: date,
      value,
    }));
}

export function AgentTimelineChart({
  title,
  legendLabel,
  data,
  period,
  onPeriodChange,
  isLoading = false,
  emptyTitle,
  emptyDescription,
  chartColor,
  legendColorClass,
  icon,
  variant = "bar",
}: AgentTimelineChartProps) {
  const selectedPeriod = (period ?? DEFAULT_TIMELINE_PERIOD).toString();
  const gradientId = useId().replace(/:/g, "");

  const chartData = useMemo(() => formatTimelineData(data), [data]);
  const hasData = chartData.length > 0 && chartData.some((point) => point.value > 0);

  const chartConfig = useMemo(
    () =>
      ({
        value: {
          label: legendLabel,
          color: chartColor,
        },
      }) satisfies ChartConfig,
    [chartColor, legendLabel]
  );

  const handlePeriodChange = (value: string) => {
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      onPeriodChange?.(parsed);
    }
  };

  return (
    <Card className="border-border/30 bg-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1">
              <div className={`h-3 w-3 rounded-sm ${legendColorClass}`} />
              {legendLabel}
            </span>
          </div>
          <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder={AGENT_TIMELINE_PERIOD_OPTIONS[0].label} />
            </SelectTrigger>
            <SelectContent>
              {AGENT_TIMELINE_PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 w-full flex items-center justify-center">
          <Spinner className="h-8 w-8 border-2 text-primary" />
        </div>
      ) : !hasData ? (
        <div className="h-64 w-full flex items-center justify-center border border-dashed border-border/30 rounded-lg">
          <EmptyStateSimple
            title={emptyTitle}
            description={emptyDescription}
            icon={icon}
            className="py-0"
          />
        </div>
      ) : variant === "area" ? (
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <AreaChart
            data={chartData}
            margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke="var(--border)"
              strokeOpacity={0.5}
            />
            <XAxis
              dataKey="day"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
              stroke="var(--muted-foreground)"
              fontSize={12}
            />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={chartColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              name={legendLabel}
            />
          </AreaChart>
        </ChartContainer>
      ) : (
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke="var(--border)"
              strokeOpacity={0.5}
            />
            <XAxis
              dataKey="day"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
              stroke="var(--muted-foreground)"
              fontSize={12}
            />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Bar
              dataKey="value"
              fill={chartColor}
              radius={[4, 4, 0, 0]}
              maxBarSize={50}
              name={legendLabel}
            />
          </BarChart>
        </ChartContainer>
      )}
    </Card>
  );
}
