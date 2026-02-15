"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Agent } from "@/types/global";
import { Fingerprint, Play, Settings } from "lucide-react";
import Link from "next/link";

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
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <Fingerprint className="mr-2 h-4 w-4" />
            <span className="font-mono">ID: {agent.id}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Settings className="h-4 w-4" />
            Configure
          </Button>
          <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Play className="h-4 w-4 fill-current" />
            Test Agent
          </Button>
        </div>
      </div>
    </div>
  );
}
