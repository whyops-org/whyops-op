"use client";

import { Copy, KeyRound, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { InfoBox } from "@/components/onboarding/info-box";
import { Button } from "@/components/ui/button";
import { EmptyStateSimple } from "@/components/ui/empty-state-simple";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SETTINGS_COPY } from "@/constants/settings";
import { formatShortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore, type MasterKey } from "@/stores/projectStore";

interface ApiKeysPanelProps {
  className?: string;
}

export function ApiKeysPanel({ className }: ApiKeysPanelProps) {
  const { masterKeys, fetchProjects } = useProjectStore();
  const { config, fetchConfig } = useConfigStore();
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (!config) {
      fetchConfig();
    }
  }, [config, fetchConfig]);

  const endpoints = useMemo(() => {
    return {
      trace: config?.proxyBaseUrl ?? "-",
      sdk: config?.apiBaseUrl ?? config?.authBaseUrl ?? "-",
    };
  }, [config]);

  const handleCopyKey = async (key: MasterKey) => {
    if (!key.key) return;
    try {
      await navigator.clipboard.writeText(key.key);
      setCopiedKeyId(key.id);
      setTimeout(() => setCopiedKeyId(null), 2000);
    } catch {
      // Ignore clipboard errors
    }
  };

  const renderKeyValue = (key: MasterKey) => {
    if (!key.key) return `${key.prefix}****`;
    const suffix = key.key.slice(-4);
    return `${key.prefix}****${suffix}`;
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="rounded-xl border border-border/50 bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{SETTINGS_COPY.apiKeysTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{SETTINGS_COPY.apiKeysSubtitle}</p>
          </div>
        </div>

        {masterKeys.length === 0 ? (
          <EmptyStateSimple
            title={SETTINGS_COPY.apiKeysEmptyTitle}
            description={SETTINGS_COPY.apiKeysEmptyDescription}
            icon={KeyRound}
            className="py-10"
          />
        ) : (
          <div className="mt-6 overflow-hidden rounded-lg border border-border/40">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Monthly Usage</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {masterKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="py-4 text-sm font-semibold text-foreground">
                      {key.name}
                    </TableCell>
                    <TableCell className="py-4">
                      <code className="rounded-md bg-surface-2 px-2 py-1 text-xs font-mono text-foreground/80">
                        {renderKeyValue(key)}
                      </code>
                    </TableCell>
                    <TableCell className="py-4 text-sm text-muted-foreground">
                      {formatShortDate(key.createdAt)}
                    </TableCell>
                    <TableCell className="py-4 text-sm text-muted-foreground">
                      {SETTINGS_COPY.apiKeysUsagePlaceholder}
                    </TableCell>
                    <TableCell className="py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyKey(key)}
                        disabled={!key.key}
                      >
                        <Copy className="h-4 w-4" />
                        {copiedKeyId === key.id ? "Copied" : "Copy"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-6">
        <div>
          <h3 className="text-base font-semibold text-foreground">{SETTINGS_COPY.endpointsTitle}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{SETTINGS_COPY.endpointsSubtitle}</p>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <EndpointCard
            label={SETTINGS_COPY.traceEndpointLabel}
            description={SETTINGS_COPY.traceEndpointDescription}
            value={endpoints.trace}
          />
          <EndpointCard
            label={SETTINGS_COPY.sdkEndpointLabel}
            description={SETTINGS_COPY.sdkEndpointDescription}
            value={endpoints.sdk}
          />
        </div>
      </div>

      <InfoBox variant="warning" icon={ShieldAlert} title={SETTINGS_COPY.securityNoticeTitle}>
        {SETTINGS_COPY.securityNoticeBody}
      </InfoBox>
    </div>
  );
}

interface EndpointCardProps {
  label: string;
  description: string;
  value: string;
}

function EndpointCard({ label, description, value }: EndpointCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value || value === "-") return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard errors
    }
  };

  return (
    <div className="rounded-lg border border-border/50 bg-surface-2/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleCopy} disabled={value === "-"}>
          <Copy className="h-4 w-4" />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="mt-3">
        <Input value={value} readOnly aria-readonly className="font-mono text-xs" />
      </div>
    </div>
  );
}
