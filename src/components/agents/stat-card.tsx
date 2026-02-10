import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  subtitle?: string;
}

export function StatCard({
  title,
  value,
  icon,
  trend,
  subtitle,
  className,
  ...props
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "flex items-start justify-between border-border/30 bg-card p-6",
        className
      )}
      {...props}
    >
      <div className="flex-1 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-3xl font-bold text-foreground">{value}</h3>
          {trend && (
            <span
              className={cn(
                "text-xs font-semibold",
                trend.isPositive ? "text-primary" : "text-destructive"
              )}
            >
              {trend.isPositive ? "↑" : "↓"} {trend.value}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          {icon}
        </div>
      )}
    </Card>
  );
}
