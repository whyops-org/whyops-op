"use client";

import { useState } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { JsonEditor } from "@/components/tools/JsonEditor";
import { ToolPageHeader } from "@/components/tools/ToolPageHeader";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TurnAnalysis {
  turnIndex: number;
  contextFillPct: number;
  adherenceScore: number;
  violations: string[];
  followed: string[];
}

interface ContextRotResult {
  turns: TurnAnalysis[];
  constraints: string[];
  killSwitchTurn: number;
  killSwitchReason: string;
  totalConstraints: number;
  contextWindow: number;
  format: string;
  detectionMethod: string;
}

const DETECTION_LABELS: Record<string, string> = {
  heuristic: "instant (0 tokens)",
  cache: "cached (0 tokens)",
  "llm-generated": "AI-parsed",
};

const SAMPLE = `{"messages":[{"role":"system","content":"Rules:\\n- Always write docstrings\\n- Never use global variables\\n- Always handle exceptions"},{"role":"user","content":"Write a URL fetcher."},{"role":"assistant","content":"def fetch(url):\\n    import requests\\n    return requests.get(url).text"},{"role":"user","content":"Add a global cache."},{"role":"assistant","content":"cache = {}\\ndef fetch_cached(url):\\n    if url not in cache: cache[url] = fetch(url)\\n    return cache[url]"}]}`;

export function ContextRotDetector() {
  const [raw, setRaw] = useState("");
  const [parsedJson, setParsedJson] = useState<unknown>(null);
  const [result, setResult] = useState<ContextRotResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRawChange = (val: string) => {
    setRaw(val);
    setParsedJson(null);
  };

  async function handleAnalyze() {
    if (!parsedJson) {
      setError("Fix the JSON errors first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tools/context-rot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: parsedJson }),
      });
      const data = (await res.json()) as ContextRotResult | { error: string };
      if ("error" in data) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch {
      setError("Failed to reach analysis service.");
    } finally {
      setLoading(false);
    }
  }

  const chartData =
    result?.turns.map((t) => ({
      turn: `T${t.turnIndex}`,
      "Context fill %": t.contextFillPct,
      "Adherence %": t.adherenceScore,
    })) ?? [];

  const minAdherence = result
    ? Math.min(...result.turns.map((t) => t.adherenceScore))
    : 100;

  return (
    <div className="space-y-6">
      <ToolPageHeader
        title="Context Rot Detector"
        description="Paste a conversation and inspect when instruction adherence starts to degrade as context fills up."
        tags={["conversation parse", "adherence trend", "reset point"]}
      />

      {!result && (
        <Card>
          <CardHeader>
            <CardTitle>Conversation input</CardTitle>
            <CardDescription>
              The backend accepts OpenAI messages, trace exports, and nested
              conversation structures.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
          <JsonEditor
            value={raw}
            onChange={handleRawChange}
            label="Conversation JSON (any format)"
            placeholder="Paste OpenAI messages, LangChain traces, Langfuse exports, or custom logs…"
            minHeight={192}
            onValidJson={setParsedJson}
            labelRight={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRaw(SAMPLE);
                  setParsedJson(null);
                }}
              >
                Load sample
              </Button>
            }
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleAnalyze}
              disabled={!parsedJson}
              loading={loading}
              size="sm"
            >
              {loading ? "Analyzing (20–40s)..." : "Detect context rot"}
              {!loading ? <ChevronRight className="h-4 w-4" /> : null}
            </Button>
            <p className="text-xs text-muted-foreground">
              Limited to 5 analyses/hour. Format auto-detected.
            </p>
          </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              { label: "Turns", value: result.turns.length },
              { label: "Constraints", value: result.totalConstraints },
              {
                label: "Kill switch",
                value: `T${result.killSwitchTurn}`,
                warn: result.killSwitchTurn < result.turns.length,
              },
              {
                label: "Min adherence",
                value: `${minAdherence}%`,
                warn: minAdherence < 70,
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

          <div className="flex flex-wrap items-center gap-2">
            <Badge>{result.format}</Badge>
            <Badge>{DETECTION_LABELS[result.detectionMethod] ?? result.detectionMethod}</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setResult(null);
                setRaw("");
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              New conversation
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Context fill vs adherence</CardTitle>
            </CardHeader>
            <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="turn"
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                  }}
                />
                <Legend
                  wrapperStyle={{
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="Context fill %"
                  stroke="var(--warning)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="Adherence %"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                {result.killSwitchTurn > 0 &&
                  result.killSwitchTurn < result.turns.length && (
                    <ReferenceLine
                      x={`T${result.killSwitchTurn}`}
                      stroke="var(--destructive)"
                      strokeDasharray="4 4"
                      label={{
                        value: "Kill switch",
                        fill: "var(--destructive)",
                        fontSize: 11,
                      }}
                    />
                  )}
              </LineChart>
            </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reset recommendation</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              {result.killSwitchReason}
            </CardContent>
          </Card>

          {result.turns.some((t) => t.violations.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Constraint violations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.turns
                  .filter((t) => t.violations.length > 0)
                  .map((t) => (
                    <div
                      key={t.turnIndex}
                      className="border border-border/60 bg-background px-4 py-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge>Turn {t.turnIndex}</Badge>
                        <span className="text-xs text-muted-foreground">Context {t.contextFillPct}%</span>
                        <span className="ml-auto text-xs font-medium text-foreground">
                          Adherence {t.adherenceScore}%
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {t.violations.map((v, i) => (
                          <li
                            key={i}
                            className="text-xs text-muted-foreground flex gap-2"
                          >
                            <span className="shrink-0 text-foreground">•</span>
                            <span>{v}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>WhyOps</CardTitle>
              <CardDescription>
                WhyOps watches instruction drift continuously and can alert when
                adherence drops below a threshold you set.
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
