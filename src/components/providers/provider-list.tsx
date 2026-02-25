import { Sparkles, User } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/lib/formatters";
import type { Provider } from "@/stores/providerStore";

const providerMeta = {
  openai: {
    label: "OpenAI",
    icon: Sparkles,
  },
  anthropic: {
    label: "Anthropic",
    icon: User,
  },
} as const;

interface ProviderListProps {
  providers: Provider[];
  variant?: "compact" | "detailed";
  className?: string;
}

export function ProviderList({ providers, variant = "compact", className }: ProviderListProps) {
  return (
    <div
      className={cn(
        "grid gap-3",
        variant === "compact" ? "sm:grid-cols-2" : "lg:grid-cols-2",
        className
      )}
    >
      {providers.map((provider) => {
        const meta = providerMeta[provider.type];
        const Icon = meta.icon;
        const statusLabel = provider.isActive ? "Active" : "Inactive";

        return (
          <div
            key={provider.id}
            className={cn(
              "flex flex-col gap-4 rounded-lg border border-border/50 bg-card p-4",
              variant === "compact" ? "sm:flex-row sm:items-center sm:justify-between" : ""
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{provider.name}</p>
                <p className="text-xs text-muted-foreground">{meta.label}</p>
              </div>
            </div>

            {variant === "detailed" && (
              <div className="grid gap-2 text-xs text-muted-foreground">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Base URL</p>
                  <p className="font-mono text-[11px] text-foreground/80">{provider.baseUrl}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Last Updated</p>
                  <p className="text-foreground/80">{formatShortDate(provider.updatedAt)}</p>
                </div>
              </div>
            )}

            <div className={cn("flex items-center justify-between", variant === "compact" ? "sm:justify-end" : "")}
            >
              <StatusBadge status={provider.isActive ? "active" : "inactive"}>{statusLabel}</StatusBadge>
            </div>
          </div>
        );
      })}
    </div>
  );
}
