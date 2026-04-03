"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChartNoAxesColumn, X } from "lucide-react";

interface AgentUserScopeProps {
  externalUserId: string;
  onClear: () => void;
}

export function AgentUserScope({ externalUserId, onClear }: AgentUserScopeProps) {
  return (
    <Card className="border-border/30 bg-card px-6 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ChartNoAxesColumn className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">User Analytics</h2>
            <Badge className="border-border/60 bg-surface-2/50 font-mono text-xs text-foreground">
              {externalUserId}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Overview cards, trend charts, and traces below are filtered to this external user.
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={onClear}>
          <X className="h-4 w-4" />
          Clear filter
        </Button>
      </div>
    </Card>
  );
}
