"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";

const whyopsTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "hsl(var(--background))",
      color: "hsl(var(--foreground))",
      fontSize: "13px",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    },
    ".cm-content": { caretColor: "hsl(var(--primary))" },
    ".cm-cursor": { borderLeftColor: "hsl(var(--primary))" },
    ".cm-gutters": {
      backgroundColor: "hsl(var(--card))",
      color: "hsl(var(--muted-foreground))",
      border: "none",
      borderRight: "1px solid hsl(var(--border))",
    },
    ".cm-activeLineGutter": { backgroundColor: "hsl(var(--muted) / 0.4)" },
    ".cm-activeLine": { backgroundColor: "hsl(var(--muted) / 0.25)" },
    ".cm-selectionBackground": { backgroundColor: "hsl(var(--primary) / 0.2)" },
    "& .cm-scroller": { lineHeight: "1.6" },
    ".cm-tooltip": {
      backgroundColor: "hsl(var(--popover))",
      border: "1px solid hsl(var(--border))",
      color: "hsl(var(--popover-foreground))",
      borderRadius: "6px",
    },
    ".cm-tooltip-lint": {
      backgroundColor: "hsl(var(--destructive) / 0.15)",
      color: "hsl(var(--destructive-foreground))",
    },
    ".tok-string": { color: "var(--foreground)" },
    ".tok-number": { color: "var(--warning)" },
    ".tok-bool": { color: "var(--muted-foreground)" },
    ".tok-null": { color: "var(--muted-foreground)" },
    ".tok-propertyName": { color: "var(--primary)" },
    ".tok-punctuation, .tok-bracket": { color: "hsl(var(--muted-foreground))" },
    ".cm-lintRange-error": { backgroundImage: "none", borderBottom: "2px solid hsl(var(--destructive))" },
    ".cm-lint-marker-error": { content: "'✗'", color: "hsl(var(--destructive))" },
  },
  { dark: true }
);

// ---------------------------------------------------------------------------
// JSON linter — positions are mapped to CodeMirror from positions
// ---------------------------------------------------------------------------
function buildJsonLinter() {
  return linter((view) => {
    const diagnostics: Diagnostic[] = [];
    const content = view.state.doc.toString();
    if (!content.trim()) return diagnostics;
    try {
      JSON.parse(content);
    } catch (e) {
      const msg = (e as SyntaxError).message;
      const posMatch = msg.match(/position (\d+)/);
      const rawPos = posMatch ? parseInt(posMatch[1]) : 0;
      const from = Math.min(rawPos, Math.max(0, content.length - 1));
      const to = Math.min(from + 1, content.length);
      diagnostics.push({ from, to, severity: "error", message: msg });
    }
    return diagnostics;
  });
}

// ---------------------------------------------------------------------------
// Friendly error message (line:col)
// ---------------------------------------------------------------------------
function getJsonError(raw: string): string | null {
  if (!raw.trim()) return null;
  try {
    JSON.parse(raw);
    return null;
  } catch (e) {
    const msg = (e as SyntaxError).message;
    const posMatch = msg.match(/position (\d+)/);
    if (posMatch) {
      const pos = parseInt(posMatch[1]);
      const before = raw.slice(0, pos);
      const line = (before.match(/\n/g) ?? []).length + 1;
      const col = pos - before.lastIndexOf("\n");
      return `Line ${line}, col ${col}: ${msg.split(" at position")[0]}`;
    }
    return msg;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  /** px height of the editor — default 200 */
  minHeight?: number;
  /** Called whenever the JSON becomes valid */
  onValidJson?: (parsed: unknown) => void;
  /** Slot rendered to the right of the label (e.g. a "Load sample" button) */
  labelRight?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
// SSR hydration guard — CodeMirror uses browser APIs
// ---------------------------------------------------------------------------
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Deferred to avoid synchronous setState in effect
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);
  return mounted;
}

export function JsonEditor({
  value,
  onChange,
  label,
  placeholder,
  minHeight = 200,
  onValidJson,
  labelRight,
}: JsonEditorProps) {
  const mounted = useMounted();
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  // Derive error synchronously from value — no setState needed
  const error = useMemo(() => getJsonError(value), [value]);
  const isValid = !error && value.trim().length > 0;

  // Notify parent when JSON becomes valid
  const prevValid = useRef(false);
  useEffect(() => {
    if (isValid && !prevValid.current) {
      try { onValidJson?.(JSON.parse(value)); } catch {}
    }
    prevValid.current = isValid;
  }, [isValid, value, onValidJson]);

  const extensions = useMemo(() => [json(), buildJsonLinter(), lintGutter()], []);

  const handleChange = useCallback((val: string) => onChange(val), [onChange]);

  const borderColor = value.trim()
    ? error
      ? "border-destructive/70"
      : "border-primary/50"
    : "border-border";

  return (
    <div className="flex flex-col gap-1.5">
      {(label || labelRight) && (
        <div className="flex items-center justify-between">
          {label && <label className="text-sm font-medium text-foreground">{label}</label>}
          {labelRight}
        </div>
      )}

      <div className={`overflow-hidden rounded-sm border ${borderColor} transition-colors`}>
        {mounted ? (
          <CodeMirror
            ref={editorRef}
            value={value}
            onChange={handleChange}
            extensions={extensions}
            theme={whyopsTheme}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
              highlightActiveLineGutter: true,
              autocompletion: true,
              bracketMatching: true,
            }}
            style={{ minHeight: `${minHeight}px` }}
            placeholder={placeholder}
          />
        ) : (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-background text-foreground font-mono text-sm px-3 py-2 resize-none focus:outline-none"
            style={{ minHeight: `${minHeight}px` }}
          />
        )}
      </div>

      <div className="flex items-center gap-1.5 min-h-[18px]">
        {value.trim() && (
          error ? (
            <span className="text-xs text-destructive flex items-center gap-1">
              <span>✗</span> {error}
            </span>
          ) : (
            <span className="text-xs text-primary flex items-center gap-1">
              <span>✓</span> Valid JSON
            </span>
          )
        )}
      </div>
    </div>
  );
}
