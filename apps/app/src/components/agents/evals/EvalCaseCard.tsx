"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import {
  EVAL_CATEGORY_LABELS,
  EVAL_DIFFICULTY_LABELS,
  type EvalCategory,
  type EvalDifficulty,
} from "@/constants/agent-evals";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EvalCase } from "@/stores/agentEvalsStore";

interface EvalCaseCardProps {
  evalCase: EvalCase;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  basic: "border-border/60 bg-surface-2/40 text-foreground",
  intermediate: "border-warning/25 bg-warning/10 text-warning",
  advanced: "border-destructive/25 bg-destructive/10 text-destructive",
};

const CATEGORY_COLORS: Record<string, string> = {
  happy_path: "border-border/60 bg-surface-2/40 text-foreground",
  edge_case: "border-warning/25 bg-warning/10 text-warning",
  multi_step: "border-primary/25 bg-primary/10 text-primary",
  safety: "border-destructive/25 bg-destructive/10 text-destructive",
  error_handling: "border-warning/25 bg-warning/10 text-warning",
  adversarial: "border-destructive/25 bg-destructive/10 text-destructive",
  feature_specific: "border-primary/25 bg-primary/10 text-primary",
};

export function EvalCaseCard({ evalCase }: EvalCaseCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const firstUserMessage = evalCase.conversation.find((t) => t.role === "user")?.content || "";
  const outcome = evalCase.expectedOutcome;
  const rubric = evalCase.scoringRubric;

  return (
    <Card className={cn("border-border/60 transition-colors", isExpanded && "border-border")}>
      <CardHeader className="p-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={cn("text-[10px] px-1.5 py-0", CATEGORY_COLORS[evalCase.category])}>
                {EVAL_CATEGORY_LABELS[evalCase.category as EvalCategory] || evalCase.category}
              </Badge>
              {evalCase.subcategory && (
                <Badge className="text-[10px] px-1.5 py-0">
                  {evalCase.subcategory}
                </Badge>
              )}
              <Badge className={cn("text-[10px] px-1.5 py-0", DIFFICULTY_COLORS[evalCase.difficulty])}>
                {EVAL_DIFFICULTY_LABELS[evalCase.difficulty as EvalDifficulty] || evalCase.difficulty}
              </Badge>
            </div>
            <p className="text-sm font-medium text-foreground">{evalCase.title}</p>
            {!isExpanded && (
              <p className="mt-1 text-xs text-muted-foreground truncate">
                {firstUserMessage.slice(0, 120)}
              </p>
            )}
          </div>
          <button type="button" className="text-muted-foreground hover:text-foreground mt-1">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="px-4 pb-4 pt-0 space-y-4">
          {evalCase.description && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Description</p>
              <p className="text-sm text-muted-foreground">{evalCase.description}</p>
            </div>
          )}

          {/* Conversation */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Conversation</p>
            <div className="space-y-2">
              {evalCase.conversation.map((turn, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-sm border px-3 py-2 text-sm",
                    turn.role === "user"
                      ? "border-border/60 bg-surface-2/20"
                      : "border-primary/20 bg-primary/5"
                  )}
                >
                  <span className="text-xs font-medium capitalize text-muted-foreground">
                    {turn.role}
                  </span>
                  <p className="mt-1 text-foreground whitespace-pre-wrap">{turn.content}</p>
                  {turn.expected_tool_calls && turn.expected_tool_calls.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {turn.expected_tool_calls.map((tc, j) => (
                        <Badge key={j} className="text-[10px]">
                          {tc.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {turn.expected_behavior && (
                    <p className="mt-2 text-xs text-muted-foreground italic">
                      Expected: {turn.expected_behavior}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Expected outcome */}
          {outcome && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Expected outcome</p>
              <div className="space-y-1 text-sm text-muted-foreground">
                {outcome.tools_called && outcome.tools_called.length > 0 && (
                  <p>Tools: <span className="font-medium text-foreground">{outcome.tools_called.join(", ")}</span></p>
                )}
                {outcome.refusal_expected && (
                  <p className="font-medium text-destructive">Agent should refuse this request</p>
                )}
                {outcome.key_assertions?.map((a, i) => (
                  <p key={i}>- {a}</p>
                ))}
              </div>
            </div>
          )}

          {/* Scoring rubric */}
          {rubric?.dimensions && rubric.dimensions.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Scoring rubric</p>
              <div className="space-y-1">
                {rubric.dimensions.map((dim, i) => (
                  <div key={i} className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{dim.name}</span>
                    <span className="text-xs ml-1">(weight: {dim.weight})</span>
                    <span className="text-xs ml-2">— {dim.criteria}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tools tested */}
          {evalCase.toolsTested.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Tools tested:</span>
              {evalCase.toolsTested.map((t) => (
                <Badge key={t} className="text-[10px]">{t}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
