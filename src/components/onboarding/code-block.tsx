"use client";

import { Copy } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: string;
  showCopy?: boolean;
  className?: string;
}

export function CodeBlock({ code, language, showCopy = true, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("group relative rounded-xl border border-border bg-card overflow-hidden", className)}>
      {showCopy && (
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 z-10 rounded-md p-2 hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground min-w-17.5 flex items-center justify-center"
          aria-label="Copy code"
        >
          {copied ? (
            <span className="text-xs font-medium text-primary">Copied!</span>
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      )}
      <pre className="p-4 overflow-x-auto scrollbar-thin">
        <code className={cn("text-sm font-mono text-foreground leading-relaxed whitespace-pre", language)}>
          {code}
        </code>
      </pre>
    </div>
  );
}
