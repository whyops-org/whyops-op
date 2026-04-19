"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyStateSimple } from "@/components/ui/empty-state-simple";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Download, Activity } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

interface ChartData {
  day: string;
  value: number;
}

interface SuccessRateChartProps {
  data: ChartData[];
  title?: string;
  subtitle?: string;
}

const chartConfig = {
  value: {
    label: "Success Rate",
    color: "var(--primary)",
  },
};

export function SuccessRateChart({
  data,
  title = "Success Rate Over Time",
  subtitle = "Weekly trend across active agents",
}: SuccessRateChartProps) {
  const hasData = data && data.length > 0 && data.some(d => d.value > 0);

  return (
    <Card className="gap-4 border-border/40 bg-card p-5">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Button variant="ghost" size="sm" className="h-8 gap-2" disabled={!hasData}>
          <Download className="h-3.5 w-3.5" />
          <span className="text-xs">Export CSV</span>
        </Button>
      </div>

      {/* Chart */}
      {!hasData ? (
        <div className="h-52 w-full flex items-center justify-center border border-dashed border-border/30">
          <EmptyStateSimple
            title="No chart data"
            description="Not enough data to display success trends yet."
            icon={Activity}
            className="py-0"
          />
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="h-52 w-full">
          <AreaChart
            data={data}
            margin={{
              left: 0,
              right: 0,
              top: 10,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-value)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-value)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--color-value)"
              strokeWidth={3}
              fill="url(#fillValue)"
              fillOpacity={1}
            />
          </AreaChart>
        </ChartContainer>
      )}
    </Card>
  );
}
