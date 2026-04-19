"use client";

import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Globe,
  Lightbulb,
  RefreshCw,
  Shield,
  Swords,
  Users,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { KnowledgeProfile } from "@/stores/agentEvalsStore";

interface KnowledgeProfileViewProps {
  profile: KnowledgeProfile | null;
  isLoading: boolean;
  onRebuild: () => void;
}

const SEVERITY_CLASSES: Record<string, string> = {
  low: "text-muted-foreground",
  medium: "text-primary",
  high: "text-warning",
  critical: "text-destructive",
};

const PRIORITY_ICONS: Record<string, string> = {
  must_have: "text-destructive",
  should_have: "text-primary",
  nice_to_have: "text-muted-foreground",
};

export function KnowledgeProfileView({ profile, isLoading, onRebuild }: KnowledgeProfileViewProps) {
  if (isLoading) {
    return (
      <Card className="border-border/60 px-6 py-10 text-center">
        <Spinner className="mx-auto h-7 w-7 border-2 border-border border-t-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Loading knowledge profile...</p>
      </Card>
    );
  }

  if (!profile) {
    return (
      <section className="rounded-sm border border-dashed border-border/70 bg-surface-2/20 px-6 py-10 text-center">
        <Brain className="mx-auto h-7 w-7 text-muted-foreground" />
        <p className="mt-3 text-lg font-semibold text-foreground">No knowledge profile yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate evals to trigger intelligence gathering, or build the profile manually.
        </p>
        <Button size="sm" variant="outline" onClick={onRebuild} className="mt-4 gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Build Knowledge Profile
        </Button>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">{profile.domain.replace(/_/g, " ")}</h3>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{profile.domainDescription}</p>
          {profile.subDomains.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile.subDomains.map((sd) => (
                <Badge key={sd} className="px-2 py-0.5">{sd}</Badge>
              ))}
            </div>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={onRebuild} loading={isLoading} className="gap-2 flex-none">
          <RefreshCw className="h-3.5 w-3.5" />
          Rebuild
        </Button>
      </div>

      {/* Competitors */}
      {profile.competitors.length > 0 && (
        <Section icon={<Swords className="h-4 w-4" />} title="Competitors">
          <div className="grid gap-3 md:grid-cols-2">
            {profile.competitors.map((c, i) => (
              <div key={i} className="rounded-sm border border-border/55 bg-surface-2/20 px-4 py-3">
                <p className="text-sm font-semibold text-foreground">{c.name}</p>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{c.description}</p>
                {c.strengths.length > 0 && (
                  <div className="mt-2">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Strengths</p>
                    <ul className="space-y-0.5">
                      {c.strengths.map((s, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-none text-primary" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {c.weaknesses.length > 0 && (
                  <div className="mt-2">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Weaknesses</p>
                    <ul className="space-y-0.5">
                      {c.weaknesses.map((w, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-none text-warning" />
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Failure Modes */}
      {profile.failureModes.length > 0 && (
        <Section icon={<AlertTriangle className="h-4 w-4" />} title="Known Failure Modes">
          <div className="space-y-3">
            {profile.failureModes.map((fm, i) => (
              <div key={i} className="rounded-sm border border-border/55 bg-surface-2/20 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-medium capitalize", SEVERITY_CLASSES[fm.severity])}>
                    {fm.severity}
                  </span>
                  <span className="text-sm font-medium text-foreground">{fm.code.replace(/_/g, " ")}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{fm.description}</p>
                {fm.examples.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {fm.examples.map((ex, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Zap className="h-3.5 w-3.5 mt-0.5 flex-none text-warning" />
                        <span>{ex}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* User Expectations */}
      {profile.userExpectations.length > 0 && (
        <Section icon={<Users className="h-4 w-4" />} title="User Expectations">
          <div className="space-y-2">
            {profile.userExpectations.map((ue, i) => (
              <div key={i} className="flex items-start gap-3 rounded-sm border border-border/55 bg-surface-2/20 px-4 py-3">
                <span className={cn(
                  "mt-0.5 flex-none text-xs font-medium capitalize",
                  PRIORITY_ICONS[ue.priority] || "text-muted-foreground"
                )}>
                  {ue.priority.replace(/_/g, " ")}
                </span>
                <p className="text-sm text-foreground leading-relaxed">{ue.expectation}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Best Practices */}
      {profile.bestPractices.length > 0 && (
        <Section icon={<Lightbulb className="h-4 w-4" />} title="Best Practices">
          <div className="space-y-2">
            {profile.bestPractices.map((bp, i) => (
              <div key={i} className="rounded-sm border border-border/55 bg-surface-2/20 px-4 py-3">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{bp.area}:</span> {bp.practice}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{bp.rationale}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Edge Case Patterns */}
      {profile.edgeCasePatterns.length > 0 && (
        <Section icon={<Globe className="h-4 w-4" />} title="Edge Case Patterns">
          <ul className="space-y-1.5">
            {profile.edgeCasePatterns.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground leading-relaxed">
                <span className="mt-1 h-1.5 w-1.5 bg-muted-foreground flex-none" />
                {p}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Safety Considerations */}
      {profile.safetyConsiderations.length > 0 && (
        <Section icon={<Shield className="h-4 w-4" />} title="Safety Considerations">
          <ul className="space-y-1.5">
            {profile.safetyConsiderations.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground leading-relaxed">
                <Shield className="h-3.5 w-3.5 mt-0.5 flex-none text-destructive/70" />
                {s}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
      </div>
      {children}
    </section>
  );
}
