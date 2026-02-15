"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyStateSimple } from "@/components/ui/empty-state-simple";
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
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { Activity } from "lucide-react";

const chartConfig = {
  value: {
    label: "Success Rate",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

interface ChartData {
  day: string;
  value: number;
}

interface AgentTraceTimelineProps {
  successPercentage: Record<string, number> | undefined;
  successRatePeriod: number | undefined;
  onPeriodChange?: (period: number) => void;
  isLoading?: boolean;
}

function transformData(
  successPercentage: Record<string, number> | undefined
): ChartData[] {
  if (!successPercentage) return [];

  return Object.entries(successPercentage)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, value]) => ({
      day: date,
      value,
    }));
}

export function AgentTraceTimeline({
  successPercentage,
  successRatePeriod,
  onPeriodChange,
  isLoading = false,
}: AgentTraceTimelineProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(
    successRatePeriod?.toString() || "7"
  );

  const data = transformData(successPercentage);
  const hasData = data.length > 0 && data.some((d) => d.value > 0);

  const handlePeriodChange = (value: string) => {
    setSelectedPeriod(value);
    onPeriodChange?.(parseInt(value, 10));
  };

  return (
    <Card className="border-border/30 bg-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-foreground">Trace Timeline</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-primary" /> Success Rate
            </span>
          </div>
          <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Last 7 Days" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="14">Last 14 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 w-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : !hasData ? (
        <div className="h-64 w-full flex items-center justify-center border border-dashed border-border/30 rounded-lg">
          <EmptyStateSimple
            title="No timeline data"
            description="No traces recorded in the selected timeframe."
            icon={Activity}
            className="py-0"
          />
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <BarChart
            accessibilityLayer
            data={data}
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
              fill="var(--color-value)"
              radius={[4, 4, 0, 0]}
              maxBarSize={50}
              name="Success Rate"
            />
          </BarChart>
        </ChartContainer>
      )}
    </Card>
  );
}
