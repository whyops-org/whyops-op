import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "success" | "warning" | "error" | "active" | "inactive" | string;
  className?: string;
  children?: React.ReactNode;
}

const STATUS_STYLES: Record<string, string> = {
  success: "border-primary/25 bg-primary/10 text-primary",
  active: "border-primary/25 bg-primary/10 text-primary",
  warning: "border-warning/30 bg-warning/10 text-warning",
  error: "border-destructive/25 bg-destructive/10 text-destructive",
  inactive: "border-border/60 bg-surface-2/40 text-muted-foreground",
};

export function StatusBadge({ status, className, children }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();
  const style = STATUS_STYLES[normalizedStatus] || STATUS_STYLES.inactive;

  return (
    <Badge
      className={cn(
        "rounded-sm px-2 py-0.5 text-[11px] font-medium border",
        style,
        className
      )}
    >
      {children || status}
    </Badge>
  );
}
