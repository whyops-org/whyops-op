"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useAgentSettingsStore } from "@/stores/agentSettingsStore";
import { useConfigStore } from "@/stores/configStore";
import type { Agent } from "@/types/global";
import { Fingerprint, Gauge, Play, Settings } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface AgentDetailHeaderProps {
  agent: Agent;
}

function firstDefinedNumber(...values: Array<number | undefined>): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function formatCount(value: number | null): string {
  if (value === null) return "-";
  return value.toLocaleString();
}

function formatPercent(value: number | null): string {
  if (value === null) return "-";
  return `${Math.round(value * 100)}%`;
}

function deriveStatus(lastActive: string): "active" | "inactive" {
  const date = new Date(lastActive);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours < 24 ? "active" : "inactive";
}

export function AgentDetailHeader({ agent }: AgentDetailHeaderProps) {
  const status = deriveStatus(agent.lastActive);
  const config = useConfigStore((state) => state.config);
  const {
    settingsByAgentId,
    globalLimits,
    permissions,
    fetchAgentSettings,
    fetchGlobalLimits,
    updateAgentSettings,
    resetAgentSettings,
    isSaving,
  } = useAgentSettingsStore((state) => ({
    settingsByAgentId: state.settingsByAgentId,
    globalLimits: state.globalLimits,
    permissions: state.permissions,
    fetchAgentSettings: state.fetchAgentSettings,
    fetchGlobalLimits: state.fetchGlobalLimits,
    updateAgentSettings: state.updateAgentSettings,
    resetAgentSettings: state.resetAgentSettings,
    isSaving: state.isSaving,
  }));
  const agentSettings = settingsByAgentId[agent.id];
  const currentSamplingRate = Math.max(0, Math.min(1, Number(agent.latestVersion?.samplingRate ?? 1)));
  const currentSamplingPercent = Math.round(currentSamplingRate * 100);
  const [samplingPercent, setSamplingPercent] = useState(Math.round(currentSamplingRate * 100));
  const [maxTracesInput, setMaxTracesInput] = useState<string>(String(agent.maxTraces ?? ""));
  const [maxSpansInput, setMaxSpansInput] = useState<string>(String(agent.maxSpans ?? ""));
  const [isSavingSampling, setIsSavingSampling] = useState(false);
  const [isSamplingPopoverOpen, setIsSamplingPopoverOpen] = useState(false);
  const [isTestAgentHintOpen, setIsTestAgentHintOpen] = useState(false);

  useEffect(() => {
    setSamplingPercent(Math.round(currentSamplingRate * 100));
  }, [currentSamplingRate]);

  useEffect(() => {
    if (!agentSettings) {
      return;
    }
    setSamplingPercent(Math.round(agentSettings.samplingRate * 100));
    setMaxTracesInput(String(agentSettings.maxTraces));
    setMaxSpansInput(String(agentSettings.maxSpans));
  }, [agentSettings]);

  useEffect(() => {
    void fetchAgentSettings(agent.id);
    if (!globalLimits) {
      void fetchGlobalLimits();
    }
  }, [agent.id, fetchAgentSettings, fetchGlobalLimits, globalLimits]);

  const hasSamplingChanges = useMemo(() => {
    const canChangeTraces = permissions.canChangeAgentMaxTraces;
    const canChangeSpans = permissions.canChangeAgentMaxSpans;

    if (!agentSettings) {
      return Math.abs(samplingPercent / 100 - currentSamplingRate) >= 0.001;
    }

    const nextTraces = Number(maxTracesInput);
    const nextSpans = Number(maxSpansInput);
    const tracesChanged =
      canChangeTraces && Number.isFinite(nextTraces) && Math.floor(nextTraces) !== agentSettings.maxTraces;
    const spansChanged =
      canChangeSpans && Number.isFinite(nextSpans) && Math.floor(nextSpans) !== agentSettings.maxSpans;
    const samplingChanged = Math.abs(samplingPercent / 100 - agentSettings.samplingRate) >= 0.001;
    return tracesChanged || spansChanged || samplingChanged;
  }, [
    agentSettings,
    currentSamplingRate,
    maxSpansInput,
    maxTracesInput,
    permissions.canChangeAgentMaxSpans,
    permissions.canChangeAgentMaxTraces,
    samplingPercent,
  ]);

  const getSamplingModeLabel = (value: number) => {
    if (value === 100) return "Full Capture";
    if (value >= 50) return "Balanced";
    if (value > 0) return "Aggressive";
    return "Paused";
  };

  const currentSamplingModeLabel = useMemo(
    () => getSamplingModeLabel(currentSamplingPercent),
    [currentSamplingPercent]
  );

  const defaultSamplingRate = firstDefinedNumber(config?.limits?.defaultSamplingRate, config?.limits?.defaultTraceSamplingRate);
  const maxAgents = firstDefinedNumber(
    globalLimits?.maxAgents,
    config?.limits?.maxAgents,
    config?.limits?.maxAgentsPerProject
  );
  const maxTraces = firstDefinedNumber(agentSettings?.maxTraces, agent.maxTraces);
  const maxSpans = firstDefinedNumber(agentSettings?.maxSpans, agent.maxSpans);

  const handleSaveSampling = async () => {
    setIsSavingSampling(true);
    const nextRate = Number((samplingPercent / 100).toFixed(2));
    const nextMaxTraces = Number(maxTracesInput);
    const nextMaxSpans = Number(maxSpansInput);
    const payload: { samplingRate?: number; maxTraces?: number; maxSpans?: number } = {
      samplingRate: nextRate,
    };

    if (permissions.canChangeAgentMaxTraces && Number.isFinite(nextMaxTraces)) {
      payload.maxTraces = Math.max(1, Math.floor(nextMaxTraces));
    }

    if (permissions.canChangeAgentMaxSpans && Number.isFinite(nextMaxSpans)) {
      payload.maxSpans = Math.max(1, Math.floor(nextMaxSpans));
    }

    const updatedSettings = await updateAgentSettings(agent.id, payload);

    if (updatedSettings === null) {
      toast.error("Failed to update agent settings");
      setIsSavingSampling(false);
      return;
    }

    toast.success("Agent settings updated");
    setIsSavingSampling(false);
    setIsSamplingPopoverOpen(false);
  };

  const handleResetToDefaults = async () => {
    setIsSavingSampling(true);
    const resetResult = await resetAgentSettings(agent.id);
    if (!resetResult) {
      toast.error("Failed to reset agent settings");
      setIsSavingSampling(false);
      return;
    }

    setSamplingPercent(Math.round(resetResult.samplingRate * 100));
    setMaxTracesInput(String(resetResult.maxTraces));
    setMaxSpansInput(String(resetResult.maxSpans));
    toast.success("Agent settings reset to defaults");
    setIsSavingSampling(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center text-sm font-medium text-muted-foreground mb-4">
        <Link href="/agents" className="hover:text-foreground transition-colors">
          Agents
        </Link>
        <span className="mx-2 text-border">/</span>
        <span className="text-foreground">{agent.name}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">{agent.name}</h1>
            <Badge className="border-primary/20 bg-primary/10 text-primary normal-case px-2 py-0.5">
              <span className="mr-1.5 h-1.5 w-1.5 bg-primary" />
              {status === "active" ? "Active" : "Inactive"}
            </Badge>
            <Badge className="border-border/60 bg-secondary/50 px-2 py-0.5 normal-case text-secondary-foreground">
              <Gauge className="mr-1.5 h-3.5 w-3.5" />
              Sampling {currentSamplingPercent}% · {currentSamplingModeLabel}
            </Badge>
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <Fingerprint className="mr-2 h-4 w-4" />
            <span className="font-mono">ID: {agent.id}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Popover open={isSamplingPopoverOpen} onOpenChange={setIsSamplingPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Settings className="h-4 w-4" />
                Configure
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[22rem] space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Trace Sampling</p>
                <p className="text-xs text-muted-foreground">
                  Control how many traces are retained for this agent version stream.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Retention Rate</Label>
                  <span className="text-sm font-medium text-foreground">{samplingPercent}%</span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[samplingPercent]}
                  onValueChange={(value) => setSamplingPercent(value[0] ?? samplingPercent)}
                  aria-label="Sampling rate"
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>0% (drop all)</span>
                  <span>100% (keep all)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Max Traces (Agent)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={maxTracesInput}
                    onChange={(event) => setMaxTracesInput(event.target.value)}
                    disabled={!permissions.canChangeAgentMaxTraces}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Max Spans (Agent)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={maxSpansInput}
                    onChange={(event) => setMaxSpansInput(event.target.value)}
                    disabled={!permissions.canChangeAgentMaxSpans}
                  />
                </div>
              </div>
              {(!permissions.canChangeAgentMaxTraces || !permissions.canChangeAgentMaxSpans) && (
                <p className="text-[11px] text-muted-foreground">
                  Max traces/spans are locked on your current plan.
                </p>
              )}

              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetToDefaults}
                  disabled={isSavingSampling || isSaving || !permissions.canChangeAgentMaxTraces || !permissions.canChangeAgentMaxSpans}
                >
                  Reset to Defaults
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveSampling}
                  disabled={!hasSamplingChanges || isSavingSampling || isSaving}
                >
                  {isSavingSampling || isSaving ? "Saving..." : "Save"}
                </Button>
              </div>

              <div className="rounded-sm border border-border/60 bg-surface-2/25 px-3 py-2.5">
                <p className="text-xs font-medium text-muted-foreground">Runtime limits</p>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <span className="text-muted-foreground">Default sampling</span>
                  <span className="text-right font-medium text-foreground">{formatPercent(defaultSamplingRate)}</span>
                  <span className="text-muted-foreground">Max traces</span>
                  <span className="text-right font-medium text-foreground">{formatCount(maxTraces)}</span>
                  <span className="text-muted-foreground">Max agents</span>
                  <span className="text-right font-medium text-foreground">{formatCount(maxAgents)}</span>
                  <span className="text-muted-foreground">Max spans</span>
                  <span className="text-right font-medium text-foreground">{formatCount(maxSpans)}</span>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Popover open={isTestAgentHintOpen} onOpenChange={setIsTestAgentHintOpen}>
            <PopoverTrigger asChild>
              <span
                onMouseEnter={() => setIsTestAgentHintOpen(true)}
                onMouseLeave={() => setIsTestAgentHintOpen(false)}
                onFocus={() => setIsTestAgentHintOpen(true)}
                onBlur={() => setIsTestAgentHintOpen(false)}
              >
                <Button
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled
                  aria-disabled="true"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Test Agent
                </Button>
              </span>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto px-3 py-2 text-xs text-muted-foreground">
              Auto evals coming soon
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
