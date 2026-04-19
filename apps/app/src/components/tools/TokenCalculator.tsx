"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { ToolPageHeader } from "@/components/tools/ToolPageHeader";
import { cn } from "@/lib/utils";
import { MODEL_PRICING_FALLBACK } from "@/constants/model-pricing";

interface ModelPricing {
  id: string;
  label: string;
  inputPer1M: number;
  outputPer1M: number;
  cacheReadPer1M: number;
  cacheWrite5mPer1M: number | null;
  cacheWrite1hPer1M: number | null;
  contextWindow: number;
  currency: "USD";
  unit: "per_1m_tokens";
  supportsPromptCaching: boolean;
  matchedModel: string;
  lastUpdatedAt: string | null;
}

interface ModelLookupResponse {
  query: string;
  validName: boolean;
  canonicalModel: string | null;
  provider: string | null;
  confidence: "high" | "medium" | "low";
  validationSource: "linkup" | "fallback";
  pricingSource: "db" | "linkup" | "fallback" | "none";
  pricing: ModelPricing | null;
  suggestions: string[];
  reasoning: string | null;
}

const PRESETS = [
  { label: "Simple", avgTurns: 8, description: "Q&A, short lookups" },
  { label: "Medium", avgTurns: 20, description: "Multi-step research" },
  { label: "Complex", avgTurns: 50, description: "Long coding / debugging" },
];

function fmt(usd: number): string {
  if (usd < 0.01) return "<$0.01";
  if (usd < 1) return `$${usd.toFixed(3)}`;
  if (usd < 100) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(0)}`;
}

function fmtNullable(usd: number | null): string {
  return usd == null ? "N/A" : fmt(usd);
}

function toDetailedFallbackModel(query: string): ModelPricing | null {
  const normalized = query.trim().toLowerCase();
  const fallback = MODEL_PRICING_FALLBACK.find(
    (item) => item.id.toLowerCase() === normalized || item.label.toLowerCase() === normalized,
  );
  if (!fallback) return null;
  return {
    ...fallback,
    currency: "USD",
    unit: "per_1m_tokens",
    supportsPromptCaching: fallback.cacheReadPer1M > 0 || fallback.cacheWrite5mPer1M != null || fallback.cacheWrite1hPer1M != null,
    matchedModel: fallback.id,
    lastUpdatedAt: null,
  };
}

function calcCost(model: ModelPricing, tasksPerDay: number, avgTurns: number) {
  const perTurn = (600 / 1_000_000) * model.inputPer1M + (400 / 1_000_000) * model.outputPer1M;
  const killSwitchTurns = Math.round(avgTurns * 1.5);
  return {
    best: perTurn * Math.max(1, Math.round(avgTurns * 0.5)) * tasksPerDay * 30,
    average: perTurn * avgTurns * tasksPerDay * 30,
    worst: perTurn * Math.round(avgTurns * 2.5) * tasksPerDay * 30,
    perTask: perTurn * avgTurns,
    perDay: perTurn * avgTurns * tasksPerDay,
    killSwitchTurns,
    contextFillAtKill: Math.min(100, Math.round(((killSwitchTurns * 1000) / model.contextWindow) * 100)),
  };
}

export function TokenCalculator() {
  const [modelQuery, setModelQuery] = useState("gpt-4o");
  const [lookup, setLookup] = useState<ModelLookupResponse | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [avgTurns, setAvgTurns] = useState(20);
  const [tasksPerDay, setTasksPerDay] = useState(10);

  async function runLookup(queryOverride?: string) {
    const trimmed = (queryOverride ?? modelQuery).trim();
    if (!trimmed) {
      setLookup(null);
      setLookupError("Enter a model name first.");
      setResolving(false);
      return;
    }

    if (queryOverride && queryOverride !== modelQuery) {
      setModelQuery(queryOverride);
    }

    setResolving(true);
    setLookupError(null);
    try {
      const res = await fetch("/api/tools/model-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      const data = (await res.json()) as ModelLookupResponse | { error: string };
      if ("error" in data) {
        throw new Error(data.error);
      }
      setLookup(data);
    } catch (err) {
      const fallback = toDetailedFallbackModel(trimmed);
      setLookup(fallback ? {
        query: trimmed,
        validName: true,
        canonicalModel: fallback.id,
        provider: null,
        confidence: "medium",
        validationSource: "fallback",
        pricingSource: "fallback",
        pricing: fallback,
        suggestions: [],
        reasoning: "Used local fallback pricing because the lookup service was unavailable.",
      } : null);
      setLookupError(err instanceof Error ? err.message : "Could not validate this model right now.");
    } finally {
      setResolving(false);
    }
  }

  const pricing = lookup?.pricing ?? null;
  const estimate = pricing ? calcCost(pricing, tasksPerDay, avgTurns) : null;
  const savings = estimate ? estimate.worst - estimate.average : 0;

  return (
    <div className="space-y-6">
      <ToolPageHeader
        title="Token Burn Calculator"
        description="Resolve a model name through the backend pricing pipeline, inspect the structured response, and estimate task and monthly spend."
        tags={["live lookup", "pricing pipeline", "monthly estimate"]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Model lookup</CardTitle>
            <CardDescription>
              Enter a model name, then request validation and pricing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="model-name">Model name</Label>
              <div className="flex gap-2">
                <Input
                  id="model-name"
                  value={modelQuery}
                  onChange={(e) => setModelQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void runLookup();
                    }
                  }}
                  placeholder="gpt-4o, claude-3-7-sonnet, gemini-2.5-pro..."
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button
                  type="button"
                  onClick={() => void runLookup()}
                  loading={resolving}
                  className="shrink-0"
                >
                  Check model
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {resolving ? <Badge>Checking…</Badge> : null}
              {lookup?.validName ? <Badge>validName: true</Badge> : null}
              {lookup && !lookup.validName && !resolving ? (
                <Badge className="border-destructive/30 bg-destructive/10 text-destructive">
                  validName: false
                </Badge>
              ) : null}
              {lookup?.canonicalModel ? <Badge>{lookup.canonicalModel}</Badge> : null}
              {lookup?.provider ? <Badge>{lookup.provider}</Badge> : null}
              {lookup?.pricingSource && lookup.pricingSource !== "none" ? (
                <Badge>{lookup.pricingSource} pricing</Badge>
              ) : null}
            </div>

            {lookup?.reasoning ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {lookup.reasoning}
              </p>
            ) : null}
            {lookupError ? (
              <p className="text-sm text-destructive">{lookupError}</p>
            ) : null}
            {lookup?.suggestions.length ? (
              <div className="flex flex-wrap gap-2">
                {lookup.suggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void runLookup(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assumptions</CardTitle>
            <CardDescription>
              Adjust the number of turns and daily task volume.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Task complexity</Label>
              <div className="grid gap-2">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant={avgTurns === preset.avgTurns ? "primary" : "outline"}
                    size="sm"
                    onClick={() => setAvgTurns(preset.avgTurns)}
                    className="justify-between"
                  >
                    <span>{preset.label}</span>
                    <span className="text-xs opacity-70">{preset.description}</span>
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Label>Avg turns per task: {avgTurns}</Label>
              <Slider
                min={1}
                max={100}
                step={1}
                value={[avgTurns]}
                onValueChange={(values) => setAvgTurns(values[0])}
              />
            </div>
            <div className="space-y-3">
              <Label>Tasks per day: {tasksPerDay}</Label>
              <Slider
                min={1}
                max={500}
                step={1}
                value={[tasksPerDay]}
                onValueChange={(values) => setTasksPerDay(values[0])}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {!pricing && !resolving ? (
        <Card>
          <CardContent className="pt-6 text-sm leading-6 text-muted-foreground">
            Enter a model name and run a lookup to load pricing. Suggestions are
            returned when the name is partial or misspelled.
          </CardContent>
        </Card>
      ) : null}

      {estimate && (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <CardHeader>
                <CardTitle>Cost estimate</CardTitle>
                <CardDescription>
                  Monthly cost range from the resolved pricing row.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    ["Best case", estimate.best],
                    ["Average", estimate.average],
                    ["Worst case", estimate.worst],
                  ].map(([label, value]) => (
                    <div key={label} className="border border-border/60 bg-background px-4 py-4">
                      <div className="text-2xl font-semibold text-foreground">
                        {fmt(value as number)}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="border border-border/60 bg-surface-2/45 px-4 py-4 text-sm leading-6 text-muted-foreground">
                  Stop at turn <span className="font-medium text-foreground">{estimate.killSwitchTurns}</span> when
                  context is roughly {estimate.contextFillAtKill}% full. Compared
                  with the worst case, that saves about{" "}
                  <span className="font-medium text-foreground">{fmt(savings)}</span>
                  {" "}per month.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Per-task breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    {[
                      ["Cost per task", fmt(estimate.perTask)],
                      ["Cost per day", fmt(estimate.perDay)],
                      ["Monthly total", fmt(estimate.average)],
                    ].map(([label, value]) => (
                      <TableRow key={label}>
                        <TableCell className="text-muted-foreground">{label}</TableCell>
                        <TableCell className="text-right font-medium text-foreground">
                          {value}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Detailed response</CardTitle>
              <CardDescription>
                Full lookup fields returned to the page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {pricing && [
                    ["query", lookup?.query ?? modelQuery],
                    ["validName", lookup?.validName ? "true" : "false"],
                    ["canonicalModel", lookup?.canonicalModel ?? "N/A"],
                    ["provider", lookup?.provider ?? "N/A"],
                    ["confidence", lookup?.confidence ?? "N/A"],
                    ["validationSource", lookup?.validationSource ?? "N/A"],
                    ["pricingSource", lookup?.pricingSource ?? "N/A"],
                    ["pricing.id", pricing.id],
                    ["pricing.label", pricing.label],
                    ["pricing.matchedModel", pricing.matchedModel],
                    ["pricing.inputPer1M", fmt(pricing.inputPer1M)],
                    ["pricing.outputPer1M", fmt(pricing.outputPer1M)],
                    ["pricing.cacheReadPer1M", fmt(pricing.cacheReadPer1M)],
                    ["pricing.cacheWrite5mPer1M", fmtNullable(pricing.cacheWrite5mPer1M)],
                    ["pricing.cacheWrite1hPer1M", fmtNullable(pricing.cacheWrite1hPer1M)],
                    ["pricing.contextWindow", `${pricing.contextWindow.toLocaleString()} tokens`],
                    ["pricing.supportsPromptCaching", pricing.supportsPromptCaching ? "true" : "false"],
                    ["pricing.currency", pricing.currency],
                    ["pricing.unit", pricing.unit],
                    ["pricing.lastUpdatedAt", pricing.lastUpdatedAt ?? "N/A"],
                  ].map(([label, value]) => (
                    <TableRow key={label}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {label}
                      </TableCell>
                      <TableCell className="text-right text-foreground">{value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {lookup?.suggestions?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {lookup.suggestions.map((suggestion) => (
                    <Badge key={suggestion}>{suggestion}</Badge>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>WhyOps</CardTitle>
          <CardDescription>
            WhyOps tracks token burn continuously and flags expensive runs before
            they become incidents.
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
    </div>
  );
}
