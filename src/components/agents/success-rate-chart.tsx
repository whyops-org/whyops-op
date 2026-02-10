"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Download } from "lucide-react";
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
  subtitle = "Weekly trend analysis across all active agents",
}: SuccessRateChartProps) {
  return (
    <Card className="border-border/30 bg-card p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Button variant="ghost" size="sm" className="h-8 gap-2">
          <Download className="h-3.5 w-3.5" />
          <span className="text-xs">Export CSV</span>
        </Button>
      </div>

      {/* Chart */}
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
    </Card>
  );
}
