import { cn } from "@/lib/utils";
import * as React from "react";

interface MacOSWindowProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
}

export function MacOSWindow({ title, children, className, ...props }: MacOSWindowProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-sm border border-border/60 bg-card shadow-none",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2 border-b border-border/50 bg-surface-2/25 px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-sm bg-surface-3" />
        <div className="h-2.5 w-2.5 rounded-sm bg-surface-3" />
        <div className="h-2.5 w-2.5 rounded-sm bg-surface-3" />
        {title && <span className="ml-2 text-xs text-muted-foreground">{title}</span>}
      </div>
      {children}
    </div>
  );
}

interface MacOSWindowHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
}

export function MacOSWindowHeader({ title, className, ...props }: MacOSWindowHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-border/50 bg-surface-2/25 px-4 py-2",
        className
      )}
      {...props}
    >
      <div className="h-2.5 w-2.5 rounded-sm bg-surface-3" />
      <div className="h-2.5 w-2.5 rounded-sm bg-surface-3" />
      <div className="h-2.5 w-2.5 rounded-sm bg-surface-3" />
      {title && <span className="ml-2 text-xs text-muted-foreground">{title}</span>}
    </div>
  );
}

type MacOSWindowContentProps = React.HTMLAttributes<HTMLDivElement>;

export function MacOSWindowContent({ className, children, ...props }: MacOSWindowContentProps) {
  return (
    <div className={cn("bg-card", className)} {...props}>
      {children}
    </div>
  );
}
