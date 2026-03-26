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
        "flex items-start justify-between gap-4 border-border/40 bg-card p-5",
        className
      )}
      {...props}
    >
      <div className="flex-1 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          {title}
        </p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-2xl font-semibold tabular-nums text-foreground">{value}</h3>
          {trend && (
            <span
              className={cn(
                "text-sm font-medium tabular-nums",
                trend.isPositive ? "text-primary" : "text-destructive"
              )}
            >
              {trend.value}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {icon && (
        <div className="flex h-10 w-10 items-center justify-center border border-border/50 bg-surface-2/30 [&_svg]:text-muted-foreground">
          {icon}
        </div>
      )}
    </Card>
  );
}
