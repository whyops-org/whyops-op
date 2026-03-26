"use client";

import { cn } from "@/lib/utils";
import * as React from "react";

type RadarProps = React.HTMLAttributes<HTMLDivElement>;

export function Radar({ className, ...props }: RadarProps) {
  return (
    <div className={cn("relative", className)} {...props}>
      <svg
        viewBox="0 0 400 400"
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="200"
          cy="200"
          r="180"
          fill="none"
          stroke="var(--border)"
          strokeWidth="1.5"
        />
        <circle
          cx="200"
          cy="200"
          r="120"
          fill="none"
          stroke="var(--border)"
          strokeWidth="1.5"
        />
        <circle
          cx="200"
          cy="200"
          r="60"
          fill="none"
          stroke="var(--border)"
          strokeWidth="1.5"
        />
        <line x1="200" y1="200" x2="200" y2="28" stroke="var(--primary)" strokeWidth="1.5" />
        <circle cx="200" cy="200" r="4" fill="var(--primary)" />
        <circle cx="280" cy="140" r="3" fill="var(--primary)" />
        <circle cx="240" cy="180" r="2.5" fill="var(--muted-foreground)" />
      </svg>
    </div>
  );
}
