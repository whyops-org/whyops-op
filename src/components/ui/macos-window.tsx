import { cn } from "@/lib/utils";
import * as React from "react";

interface MacOSWindowProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
}

export function MacOSWindow({ title, children, className, ...props }: MacOSWindowProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/50 bg-[oklch(0.15_0.02_180)] shadow-lg",
        className
      )}
      {...props}
    >
      {/* macOS Window Controls */}
      <div className="flex items-center gap-2 border-b border-border/20 bg-[oklch(0.17_0.02_180)] px-4 py-3">
        <div className="h-3 w-3 rounded-full bg-destructive" />
        <div className="h-3 w-3 rounded-full bg-[oklch(0.75_0.15_85)]" />
        <div className="h-3 w-3 rounded-full bg-[oklch(0.65_0.15_145)]" />
        {title && <span className="ml-2 text-xs text-muted-foreground">{title}</span>}
      </div>
      
      {/* Content */}
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
        "flex items-center gap-2 border-b border-border/20 bg-[oklch(0.17_0.02_180)] px-4 py-2",
        className
      )}
      {...props}
    >
      <div className="h-2.5 w-2.5 rounded-full bg-destructive" />
      <div className="h-2.5 w-2.5 rounded-full bg-[oklch(0.75_0.15_85)]" />
      <div className="h-2.5 w-2.5 rounded-full bg-[oklch(0.65_0.15_145)]" />
      {title && <span className="ml-2 text-xs text-muted-foreground">{title}</span>}
    </div>
  );
}

type MacOSWindowContentProps = React.HTMLAttributes<HTMLDivElement>;

export function MacOSWindowContent({ className, children, ...props }: MacOSWindowContentProps) {
  return (
    <div className={cn("bg-[oklch(0.15_0.02_180)]", className)} {...props}>
      {children}
    </div>
  );
}
