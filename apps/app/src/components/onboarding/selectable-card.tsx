import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface SelectableCardProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  isSelected: boolean;
  onClick: () => void;
  className?: string;
  children?: ReactNode;
  disabled?: boolean;
}

export function SelectableCard({
  icon: Icon,
  title,
  description,
  isSelected,
  onClick,
  className,
  children,
  disabled = false
}: SelectableCardProps) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "relative flex flex-col items-start gap-3 border px-4 py-4 text-left transition-colors",
        isSelected
          ? "border-primary/30 bg-surface-2/25"
          : "border-border/60 bg-card hover:bg-surface-2/20",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      type="button"
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-sm border border-border/60 bg-background transition-colors",
          isSelected ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <div className={cn(
          "text-base font-medium text-foreground"
        )}>
          {title}
        </div>
        {description && (
          <div className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </div>
        )}
      </div>
      {children}
    </button>
  );
}
