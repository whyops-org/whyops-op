"use client";

import { useState } from "react";
import Link from "next/link";
import { JsonEditor } from "@/components/tools/JsonEditor";
import { ToolPageHeader } from "@/components/tools/ToolPageHeader";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface LoopEntry {
  tool: string;
  params: unknown;
  count: number;
  runIndices: number[];
}

interface ErrorPattern {
  pattern: string;
  count: number;
  runIndices: number[];
}

interface DetectionResult {
  loops: LoopEntry[];
  errorPatterns: ErrorPattern[];
  totalToolCalls: number;
  loopedCallCount: number;
  detectedFormats: string[];
  detectionMethods: string[];
  rootCause?: {
    rootCause: string;
    fix: string;
    confidence: "high" | "medium" | "low";
  } | null;
}

const DETECTION_LABELS: Record<string, string> = {
  heuristic: "0 tokens",
  cache: "cached",
  "llm-generated": "AI-parsed",
  failed: "unknown",
};

const SAMPLE = JSON.stringify(
  [
    { role: "user", content: "Install pandas and run analysis" },
    {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "c1",
          type: "function",
          function: { name: "run_bash", arguments: '{"cmd":"pip install pandas"}' },
        },
      ],
    },
    { role: "tool", tool_call_id: "c1", content: "Error: bash: pip: command not found" },
    {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "c2",
          type: "function",
          function: { name: "run_bash", arguments: '{"cmd":"pip install pandas"}' },
        },
      ],
    },
    { role: "tool", tool_call_id: "c2", content: "Error: bash: pip: command not found" },
    {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "c3",
          type: "function",
          function: { name: "run_bash", arguments: '{"cmd":"pip install pandas"}' },
        },
      ],
    },
    { role: "tool", tool_call_id: "c3", content: "Error: bash: pip: command not found" },
  ],
  null,
  2,
);

export function LoopDetector() {
  const [inputs, setInputs] = useState<string[]>([""]);
  const [parsedRuns, setParsedRuns] = useState<(unknown | null)[]>([null]);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleInputChange(idx: number, val: string) {
    const next = [...inputs];
    next[idx] = val;
    setInputs(next);
    const nextParsed = [...parsedRuns];
    nextParsed[idx] = null;
    setParsedRuns(nextParsed);
  }

  function handleValidJson(idx: number, parsed: unknown) {
    const next = [...parsedRuns];
    next[idx] = parsed;
    setParsedRuns(next);
  }

  const validRuns = parsedRuns.filter(Boolean);

  async function handleDetect() {
    if (validRuns.length === 0) {
      setError("Paste at least one valid run log.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tools/loop-detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runs: validRuns }),
      });
      const data = (await res.json()) as DetectionResult | { error: string };
      if ("error" in data) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch {
      setError("Failed to reach detection service.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRootCause() {
    if (!result) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/tools/loop-detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runs: validRuns, includeRootCause: true }),
      });
      const data = (await res.json()) as DetectionResult;
      setResult(data);
    } catch {
      // keep existing result
    } finally {
      setAnalyzing(false);
    }
  }

  function loadSample() {
    setInputs([SAMPLE]);
    setParsedRuns([null]);
    setResult(null);
  }

  return (
    <div className="space-y-6">
      <ToolPageHeader
        title="Loop Detector"
        description="Compare one or more runs and surface repeated tool calls, repeated errors, and likely retry loops."
        tags={["multi-run parse", "loop groups", "root cause"]}
      />

      <div className="space-y-4">
        {inputs.map((val, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">Run {i + 1}</CardTitle>
                <CardDescription>Paste a single run payload.</CardDescription>
              </div>
              {inputs.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setInputs(inputs.filter((_, idx) => idx !== i));
                    setParsedRuns(parsedRuns.filter((_, idx) => idx !== i));
                  }}
                >
                  Remove
                </Button>
              )}
            </CardHeader>
            <CardContent>
            <JsonEditor
              value={val}
              onChange={(v) => handleInputChange(i, v)}
              placeholder="Paste any format: OpenAI messages, LangChain runs, Langfuse traces, custom logs…"
              minHeight={160}
              onValidJson={(parsed) => handleValidJson(i, parsed)}
            />
            </CardContent>
          </Card>
        ))}

        <div className="flex gap-2 items-center">
          {inputs.length < 5 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInputs([...inputs, ""]);
                setParsedRuns([...parsedRuns, null]);
              }}
            >
              + Add another run
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={loadSample}>
            Load sample
          </Button>
          <Button
            className="ml-auto"
            size="sm"
            onClick={handleDetect}
            disabled={validRuns.length === 0}
            loading={loading}
          >
            Detect loops
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {result && (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              { label: "Tool calls", value: result.totalToolCalls },
              {
                label: "Looped calls",
                value: result.loopedCallCount,
                warn: result.loopedCallCount > 0,
              },
              {
                label: "Loop patterns",
                value: result.loops.length,
                warn: result.loops.length > 0,
              },
              {
                label: "Error patterns",
                value: result.errorPatterns.length,
                warn: result.errorPatterns.length > 0,
              },
            ].map((s) => (
              <Card
                key={s.label}
                className="gap-0 py-4"
              >
                <CardContent className="space-y-1">
                  <div className="text-sm text-muted-foreground">{s.label}</div>
                  <div className="text-xl font-semibold text-foreground">
                    {s.value}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {result.detectedFormats.length > 0 ? (
              <Badge>{[...new Set(result.detectedFormats)].join(", ")}</Badge>
            ) : null}
            {[...new Set(result.detectionMethods)].map((method) => (
              <Badge key={method}>{DETECTION_LABELS[method] ?? method}</Badge>
            ))}
          </div>

          {result.loops.length === 0 && result.errorPatterns.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                No loops or repeated patterns detected. Try adding more run
                logs.
              </CardContent>
            </Card>
          )}

          {result.loops.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Repeated tool calls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.loops.map((l, i) => (
                  <div
                    key={i}
                    className="border border-border/60 bg-background px-4 py-4"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground font-mono">
                        {l.tool}()
                      </span>
                      <span className="text-xs text-muted-foreground">
                        called {l.count}×{" "}
                        {l.runIndices.length > 1
                          ? `across runs ${l.runIndices.map((r) => r + 1).join(", ")}`
                          : `in run ${l.runIndices[0] + 1}`}
                      </span>
                    </div>
                    <pre className="text-xs text-muted-foreground overflow-x-auto">
                      {JSON.stringify(l.params, null, 2).slice(0, 200)}
                    </pre>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {result.errorPatterns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recurring errors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.errorPatterns.map((ep, i) => (
                  <div
                    key={i}
                    className="border border-border/60 bg-background px-4 py-4"
                  >
                    <p className="text-xs font-mono text-muted-foreground">
                      {ep.pattern}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Occurred {ep.count}×{" "}
                      {ep.runIndices.length > 1
                        ? `across runs ${ep.runIndices.map((r) => r + 1).join(", ")}`
                        : ""}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {(result.loops.length > 0 || result.errorPatterns.length > 0) &&
            !result.rootCause && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle className="text-base">Root-cause analysis</CardTitle>
                    <CardDescription>
                      Request an explanation and a concrete fix from the backend.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRootCause}
                    loading={analyzing}
                    className="shrink-0"
                  >
                    Analyze
                  </Button>
                </CardHeader>
              </Card>
            )}

          {result.rootCause && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>Root cause</CardTitle>
                  <Badge>{result.rootCause.confidence} confidence</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-foreground">
                  {result.rootCause.rootCause}
                </p>
                <div className="border border-border/60 bg-background px-4 py-4">
                  <div className="mb-1 text-sm font-medium text-foreground">Recommended fix</div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {result.rootCause.fix}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>WhyOps</CardTitle>
              <CardDescription>
                WhyOps runs this loop analysis continuously across captured
                traces and agent runs.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Link
                href="/"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Open WhyOps
              </Link>
            </CardFooter>
          </Card>
        </>
      )}
    </div>
  );
}
