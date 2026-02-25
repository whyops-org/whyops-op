"use client";

import { useMemo } from "react";
import JsonView from "@uiw/react-json-view";
import { darkTheme } from "@uiw/react-json-view/dark";

import { cn } from "@/lib/utils";

interface JsonViewerProps {
  value: string;
  className?: string;
  variant?: "default" | "compact";
}

type JsonContainer = Record<string, unknown> | unknown[];

function isContainer(value: unknown): value is JsonContainer {
  return typeof value === "object" && value !== null;
}

function tryParseJson(value: string): { parsed: unknown; success: boolean } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { parsed: value, success: false };
  }
  try {
    return { parsed: JSON.parse(trimmed), success: true };
  } catch {
    return { parsed: value, success: false };
  }
}

function parseJsonIterative(input: string): unknown {
  const initial = tryParseJson(input);
  const root: unknown = initial.success ? initial.parsed : input;

  const stack: Array<{
    parent: JsonContainer;
    key: string | number;
    value: unknown;
  }> = [];

  const pushChildren = (container: JsonContainer) => {
    if (Array.isArray(container)) {
      container.forEach((value, index) => {
        stack.push({ parent: container, key: index, value });
      });
      return;
    }

    Object.entries(container).forEach(([key, value]) => {
      stack.push({ parent: container, key, value });
    });
  };

  if (isContainer(root)) {
    pushChildren(root);
  }

  while (stack.length > 0) {
    const { parent, key, value } = stack.pop()!;
    if (typeof value === "string") {
      const parsed = tryParseJson(value);
      if (parsed.success) {
        if (Array.isArray(parent)) {
          if (typeof key === "number") {
            parent[key] = parsed.parsed;
          }
        } else {
          parent[key as string] = parsed.parsed;
        }
        if (isContainer(parsed.parsed)) {
          pushChildren(parsed.parsed);
        }
      }
      continue;
    }

    if (isContainer(value)) {
      pushChildren(value);
    }
  }

  return root;
}

const jsonTheme = {
  ...darkTheme,
  "--w-rjv-background-color": "transparent",
  "--w-rjv-line-color": "color-mix(in srgb, var(--border) 60%, transparent)",
  "--w-rjv-arrow-color": "var(--muted-foreground)",
  "--w-rjv-color": "var(--foreground)",
  "--w-rjv-key-string": "var(--foreground)",
  "--w-rjv-key-number": "var(--foreground)",
  "--w-rjv-curlybraces-color": "var(--muted-foreground)",
  "--w-rjv-colon-color": "var(--muted-foreground)",
  "--w-rjv-brackets-color": "var(--muted-foreground)",
  "--w-rjv-ellipsis-color": "var(--muted-foreground)",
  "--w-rjv-quotes-color": "var(--muted-foreground)",
  "--w-rjv-quotes-string-color": "var(--accent-strong)",
  "--w-rjv-type-string-color": "var(--accent-strong)",
  "--w-rjv-type-int-color": "var(--primary)",
  "--w-rjv-type-float-color": "var(--primary)",
  "--w-rjv-type-bigint-color": "var(--primary)",
  "--w-rjv-type-boolean-color": "var(--warning)",
  "--w-rjv-type-date-color": "var(--primary)",
  "--w-rjv-type-url-color": "var(--accent-strong)",
  "--w-rjv-type-null-color": "var(--muted-foreground)",
  "--w-rjv-type-nan-color": "var(--muted-foreground)",
  "--w-rjv-type-undefined-color": "var(--muted-foreground)",
};

export function JsonViewer({ value, className, variant = "default" }: JsonViewerProps) {
  const parsed = useMemo(() => parseJsonIterative(value), [value]);
  const data = isContainer(parsed) ? parsed : { value: parsed };

  return (
    <div className={cn("json-viewer", variant === "compact" && "json-viewer-compact", className)}>
      <JsonView
        value={data as object}
        collapsed={variant === "compact" ? 1 : 2}
        displayDataTypes={false}
        displayObjectSize={false}
        enableClipboard={false}
        shortenTextAfterLength={80}
        style={jsonTheme}
      />
    </div>
  );
}
