import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface InfoBoxProps {
  variant?: "info" | "success" | "warning" | "error";
  icon?: LucideIcon;
  title: string;
  children: ReactNode;
  className?: string;
}

const variantStyles = {
  info: {
    container: "border-border/60 bg-surface-2/20",
    iconBg: "border border-border/60 bg-background",
    iconColor: "text-foreground",
    titleColor: "text-foreground",
    contentColor: "text-muted-foreground",
  },
  success: {
    container: "border-primary/20 bg-primary/5",
    iconBg: "border border-primary/20 bg-background",
    iconColor: "text-primary",
    titleColor: "text-primary",
    contentColor: "text-muted-foreground",
  },
  warning: {
    container: "border-warning/25 bg-warning/10",
    iconBg: "border border-warning/30 bg-background",
    iconColor: "text-warning",
    titleColor: "text-warning",
    contentColor: "text-muted-foreground",
  },
  error: {
    container: "border-destructive/20 bg-destructive/5",
    iconBg: "border border-destructive/20 bg-background",
    iconColor: "text-destructive",
    titleColor: "text-destructive",
    contentColor: "text-muted-foreground",
  },
};

export function InfoBox({ 
  variant = "info", 
  icon: Icon, 
  title, 
  children,
  className 
}: InfoBoxProps) {
  const styles = variantStyles[variant];
  
  return (
    <div className={cn(
      "flex items-start gap-4 rounded-sm border p-5",
      styles.container,
      className
    )}>
    {Icon && <div className={cn(
        "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-sm",
        styles.iconBg
      )}>
        <Icon className={cn("h-5 w-5", styles.iconColor)} />
      </div>}
      <div className="flex-1 space-y-2.5">
        {title && <p className={cn("text-sm font-medium", styles.titleColor)}>{title}</p>}
        <div className={cn("text-sm leading-relaxed", styles.contentColor)}>
          {children}
        </div>
      </div>
    </div>
  );
}
