import { cn } from "@/lib/utils";
import * as LucideIcons from "lucide-react";

interface TimelineIconProps {
  iconName: string;
  type: string;
  className?: string;
}

const ICON_BG_MAP: Record<string, string> = {
  input: "border-border/60 bg-surface-2/40 text-foreground",
  llm: "border-primary/25 bg-primary/10 text-primary",
  logic: "border-warning/25 bg-warning/10 text-warning",
  tool: "border-primary/25 bg-primary/10 text-primary",
  output: "border-border/60 bg-surface-2/40 text-foreground",
};

export function TimelineIcon({ iconName, type, className }: TimelineIconProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconComponent = (LucideIcons as any)[iconName] || LucideIcons.Circle;
  const style = ICON_BG_MAP[type] || "bg-muted/10 text-muted-foreground border-border/20";

  return (
    <div
      className={cn(
        "z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border bg-background",
        style,
        className
      )}
    >
      <IconComponent className="h-5 w-5" />
    </div>
  );
}
