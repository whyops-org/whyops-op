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
              "flex flex-col gap-4 rounded-sm border border-border/50 bg-card p-5",
              variant === "compact" ? "sm:flex-row sm:items-center sm:justify-between" : ""
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-border/50 bg-surface-2/40 text-muted-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">{provider.name}</p>
                <p className="text-sm text-muted-foreground">{meta.label}</p>
              </div>
            </div>

            {variant === "detailed" && (
              <div className="grid gap-3 text-sm text-muted-foreground">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Base URL</p>
                  <p className="break-all font-mono text-xs text-foreground/80 sm:text-sm">{provider.baseUrl}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Last updated</p>
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
