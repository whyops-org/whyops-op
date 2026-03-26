"use client";

import { cn } from "@/lib/utils";
import { Copy, Check } from "lucide-react";
import * as React from "react";

interface CodeBlockProps {
  content: string | object;
  label?: string;
  className?: string;
  maxHeight?: string;
}

export function CodeBlock({ content, label, className, maxHeight = "h-32" }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);

  const displayContent = typeof content === "object" 
    ? JSON.stringify(content, null, 2) 
    : content;

  const handleCopy = () => {
    navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>{label}</span>
          <button 
            onClick={handleCopy}
            className="flex items-center gap-1 hover:text-primary transition-colors focus:outline-hidden"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy JSON"}
          </button>
        </div>
      )}
      <div 
        className={cn(
          "rounded-md border border-border/50 bg-surface-2/50 p-3 font-mono text-xs text-muted-foreground overflow-x-auto",
          maxHeight,
          "scrollbar-thin"
        )}
      >
        <pre>{displayContent}</pre>
      </div>
    </div>
  );
}
