"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { TraceDetail } from "@/stores/traceDetailStore";
import { TraceTimeline } from "@/components/traces/trace-timeline";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

const TraceCanvas = dynamic(
  () => import("@/components/traces/trace-canvas").then((m) => m.TraceCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading canvas…
      </div>
    ),
  },
);

type ViewMode = "canvas" | "timeline";

interface ParseResponse {
  format: string;
  detectionMethod: "heuristic" | "cache" | "llm-generated" | "failed";
  events: unknown[];
  messages: unknown[];
  failureReason?: string;
}

const DETECTION_LABELS: Record<string, string> = {
  heuristic: "instant match",
  cache: "cached (0 tokens)",
  "llm-generated": "AI-parsed",
  failed: "unrecognized",
};

const FORMAT_LABELS: Record<string, string> = {
  "openai-messages": "OpenAI messages",
  "anthropic-messages": "Anthropic messages",
  "whyops-native": "WhyOps trace",
  langfuse: "Langfuse",
  langchain: "LangChain",
  opentelemetry: "OpenTelemetry",
  "generic-history": "Generic history",
  "generic-steps": "Generic steps",
  "flat-turns": "Flat turns",
  "recursive-conversation": "Nested conversation",
  cached: "Cached format",
  "llm-generated": "Auto-detected",
};

const SAMPLE = `{
  "messages": [
    {"role":"system","content":"You are a coding assistant."},
    {"role":"user","content":"Write a Python CSV parser."},
    {"role":"assistant","content":null,"tool_calls":[{"id":"c1","type":"function","function":{"name":"write_file","arguments":"{\\"path\\":\\"parse.py\\",\\"code\\":\\"import csv\\\\ndef parse(f): return list(csv.DictReader(open(f)))\\"}"}}]},
    {"role":"tool","tool_call_id":"c1","content":"File written."},
    {"role":"assistant","content":"Done! I created parse.py with the CSV parser function."}
  ]
}`;

function eventsToTrace(events: unknown[]): TraceDetail {
  const now = new Date().toISOString();
  return {
    threadId: "autopsy",
    userId: "anonymous",
    firstEventTimestamp: now,
    lastEventTimestamp: now,
    duration: events.length * 1000,
    eventCount: events.length,
    totalTokens: 0,
    totalLatency: 0,
    avgLatency: 0,
    errorCount: (events as { eventType: string }[]).filter(
      (e) => e.eventType === "error",
    ).length,
    events: events as TraceDetail["events"],
    hasLateEvents: false,
  };
}

export function RunAutopsy() {
  const [raw, setRaw] = useState("");
  const [parsedJson, setParsedJson] = useState<unknown>(null);
  const [trace, setTrace] = useState<TraceDetail | null>(null);
  const [parseInfo, setParseInfo] = useState<{
    format: string;
    method: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("canvas");

  const handleRawChange = (val: string) => {
    setRaw(val);
    setParsedJson(null);
  };

  async function handleVisualize() {
    if (!parsedJson) {
      setErrorMsg("Fix the JSON errors before visualizing.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/tools/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: parsedJson, mode: "events" }),
      });
      const data = (await res.json()) as ParseResponse;
      if (data.detectionMethod === "failed" || data.events.length === 0) {
        setErrorMsg(
          data.failureReason
            ? `Could not parse this format. ${data.failureReason}`
            : "Could not parse this format. The server tried heuristics and schema-based AI parsing, but no valid event structure was produced.",
        );
        return;
      }
      setParseInfo({
        format: FORMAT_LABELS[data.format] ?? data.format,
        method:
          DETECTION_LABELS[data.detectionMethod] ?? data.detectionMethod,
      });
      setTrace(eventsToTrace(data.events));
    } catch {
      setErrorMsg("Could not reach parse service.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <ToolPageHeader
        title="Run Autopsy"
        description="Paste a run payload, let the backend normalize it, then inspect the result as a trace graph or timeline."
        tags={["trace parse", "flow view", "timeline"]}
      />

      {!trace && (
        <Card>
          <CardHeader>
            <CardTitle>Run input</CardTitle>
            <CardDescription>
              Supports message arrays, trace exports, and nested conversation
              payloads.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
          <JsonEditor
            value={raw}
            onChange={handleRawChange}
            label="Paste your run JSON"
            placeholder="Paste any format: OpenAI messages, LangChain runs, Langfuse traces, custom logs…"
            minHeight={220}
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
          {errorMsg && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleVisualize}
              disabled={!parsedJson}
              loading={loading}
              size="sm"
            >
              Visualize run
              <ChevronRight className="h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground">
              Your data never leaves your server session.
            </p>
          </div>
          </CardContent>
        </Card>
      )}

      {trace && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { label: "Steps", value: trace.eventCount },
              {
                label: "Errors",
                value: trace.errorCount,
                warn: trace.errorCount > 0,
              },
              {
                label: "Tool calls",
                value: trace.events.filter((e) =>
                  e.eventType === "tool_call" ||
                  e.eventType === "tool_call_request" ||
                  e.eventType === "tool_call_response" ||
                  e.eventType === "tool_result",
                ).length,
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
            {parseInfo && (
              <>
                <Badge>{parseInfo.format}</Badge>
                <Badge>{parseInfo.method}</Badge>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTrace(null);
                setParseInfo(null);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              Paste new run
            </Button>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Trace output</CardTitle>
                  <CardDescription>
                    Switch between graph and timeline views of the parsed run.
                  </CardDescription>
                </div>
                <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
                  <TabsList variant="line">
                    <TabsTrigger value="canvas">Flow view</TabsTrigger>
                    <TabsTrigger value="timeline">Timeline view</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className="overflow-hidden border border-border/60"
                style={{ height: "520px" }}
              >
                {viewMode === "canvas" ? (
                  <TraceCanvas trace={trace} />
                ) : (
                  <TraceTimeline trace={trace} />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>WhyOps</CardTitle>
              <CardDescription>
                WhyOps captures traces directly from your agents so you do not
                have to reconstruct them from pasted exports.
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
