"use client";

import { Copy } from "lucide-react";
import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: string;
  showCopy?: boolean;
  className?: string;
}

export function CodeBlock({ code, language = "python", showCopy = true, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Map language ids to syntax highlighter languages
  const languageMap: Record<string, string> = {
    bash: "bash",
    go: "go",
    http: "bash",
    python: "python",
    sh: "bash",
    shell: "bash",
    javascript: "javascript",
    typescript: "typescript",
    js: "javascript",
    ts: "typescript",
  };

  const hlLanguage = languageMap[language] || language;

  return (
    <div className={cn("group relative overflow-hidden rounded-sm border border-border bg-card", className)}>
      {showCopy && (
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 z-10 flex min-w-18 items-center justify-center rounded-sm p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          aria-label="Copy code"
        >
          {copied ? (
            <span className="text-xs font-medium text-primary">Copied!</span>
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      )}
      <div className="max-h-[240px] overflow-auto">
        <SyntaxHighlighter
          language={hlLanguage}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: "1rem",
            background: "transparent",
            fontSize: "0.875rem",
            border: 'none',
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
          showLineNumbers={false}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
