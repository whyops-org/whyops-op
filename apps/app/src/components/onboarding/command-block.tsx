"use client";

import { Copy } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

interface CommandBlockProps {
  command: string;
  className?: string;
}

export function CommandBlock({ command, className }: CommandBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("group relative overflow-hidden rounded-sm border border-border bg-card", className)}>
      <div className="flex items-center justify-between px-4 py-3 font-mono text-sm">
        <code className="text-primary">{command}</code>
        <button
          onClick={handleCopy}
          className="flex min-w-17.5 items-center justify-center rounded-sm p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          aria-label="Copy command"
        >
          {copied ? (
            <span className="text-xs font-medium text-primary">Copied!</span>
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
