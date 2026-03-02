"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { useAgentsStore } from "@/stores/agentsStore";
import type { Agent } from "@/types/global";
import { Fingerprint, Gauge, Play, Settings } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface AgentDetailHeaderProps {
  agent: Agent;
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
  const updateAgentSamplingRate = useAgentsStore((state) => state.updateAgentSamplingRate);
  const currentSamplingRate = Math.max(0, Math.min(1, Number(agent.latestVersion?.samplingRate ?? 1)));
  const currentSamplingPercent = Math.round(currentSamplingRate * 100);
  const [samplingPercent, setSamplingPercent] = useState(Math.round(currentSamplingRate * 100));
  const [isSavingSampling, setIsSavingSampling] = useState(false);
  const [isSamplingPopoverOpen, setIsSamplingPopoverOpen] = useState(false);

  useEffect(() => {
    setSamplingPercent(Math.round(currentSamplingRate * 100));
  }, [currentSamplingRate]);

  const hasSamplingChanges = useMemo(() => {
    return Math.abs(samplingPercent / 100 - currentSamplingRate) >= 0.001;
  }, [samplingPercent, currentSamplingRate]);

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

  const handleSaveSampling = async () => {
    setIsSavingSampling(true);
    const nextRate = Number((samplingPercent / 100).toFixed(2));
    const savedRate = await updateAgentSamplingRate(agent.id, nextRate);

    if (savedRate === null) {
      toast.error("Failed to update sampling rate");
      setIsSavingSampling(false);
      return;
    }

    toast.success(`Sampling rate updated to ${Math.round(savedRate * 100)}%`);
    setIsSavingSampling(false);
    setIsSamplingPopoverOpen(false);
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
            <Badge className="bg-primary/20 text-primary border-primary/20 hover:bg-primary/30 normal-case tracking-normal px-2.5 py-0.5">
              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
              {status.toUpperCase()}
            </Badge>
            <Badge className="normal-case tracking-normal px-2.5 py-0.5 border-border/60 bg-secondary/50 text-secondary-foreground hover:bg-secondary/60">
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

              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSamplingPercent(100)}
                  disabled={isSavingSampling || samplingPercent === 100}
                >
                  Reset to 100%
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveSampling}
                  disabled={!hasSamplingChanges || isSavingSampling}
                >
                  {isSavingSampling ? "Saving..." : "Save"}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Play className="h-4 w-4 fill-current" />
            Test Agent
          </Button>
        </div>
      </div>
    </div>
  );
}
