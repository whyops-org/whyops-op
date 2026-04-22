"use client";

import { Copy, KeyRound, Plus, RefreshCcw, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { InfoBox } from "@/components/onboarding/info-box";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyStateSimple } from "@/components/ui/empty-state-simple";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SETTINGS_COPY } from "@/constants/settings";
import { apiClient } from "@/lib/api-client";
import { formatShortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/stores/configStore";
import { toast } from "sonner";

interface ApiKeysPanelProps {
  className?: string;
}

interface ApiKeyStageRow {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  environmentId: string;
  stage: string;
  keyPrefix: string;
  maskedKey: string;
  canReveal: boolean;
  isMaster: boolean;
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

interface ProjectWithEnvironments {
  id: string;
  name: string;
  environments?: Array<{
    id: string;
    name: string;
    isActive: boolean;
  }>;
}

interface EnvironmentOption {
  projectId: string;
  projectName: string;
  environmentId: string;
  environmentName: string;
}

export function ApiKeysPanel({ className }: ApiKeysPanelProps) {
  const { config, fetchConfig } = useConfigStore();
  const [apiKeys, setApiKeys] = useState<ApiKeyStageRow[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [revealingKeyId, setRevealingKeyId] = useState<string | null>(null);
  const [regeneratingKeyId, setRegeneratingKeyId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyEnvironmentId, setNewKeyEnvironmentId] = useState("");
  const [environmentOptions, setEnvironmentOptions] = useState<EnvironmentOption[]>([]);
  const [sessionPlainKeys, setSessionPlainKeys] = useState<Record<string, string>>({});

  const loadApiKeys = useCallback(async () => {
    setIsLoadingKeys(true);
    setKeysError(null);
    try {
      const response = await apiClient.get<{ apiKeys: ApiKeyStageRow[] }>("/api/api-keys/stages");
      setApiKeys(response.data.apiKeys || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load API keys";
      setKeysError(message);
    } finally {
      setIsLoadingKeys(false);
    }
  }, []);

  const loadEnvironmentOptions = useCallback(async () => {
    try {
      const response = await apiClient.get<{ projects: ProjectWithEnvironments[] }>("/api/projects");
      const projects = response.data.projects || [];
      const options = projects.flatMap((project) =>
        (project.environments || [])
          .filter((environment) => environment.isActive)
          .map((environment) => ({
            projectId: project.id,
            projectName: project.name,
            environmentId: environment.id,
            environmentName: environment.name,
          }))
      );
      setEnvironmentOptions(options);
      if (!newKeyEnvironmentId && options.length > 0) {
        setNewKeyEnvironmentId(options[0].environmentId);
      }
    } catch {
      toast.error("Failed to load environments");
    }
  }, [newKeyEnvironmentId]);

  useEffect(() => {
    loadApiKeys();
    loadEnvironmentOptions();
  }, [loadApiKeys, loadEnvironmentOptions]);

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

  const handleCopyKey = async (key: ApiKeyStageRow) => {
    const sessionPlainKey = sessionPlainKeys[key.id];
    if (sessionPlainKey) {
      try {
        await navigator.clipboard.writeText(sessionPlainKey);
        setCopiedKeyId(key.id);
        setTimeout(() => setCopiedKeyId(null), 2000);
      } catch {
        toast.error("Failed to copy API key");
      }
      return;
    }

    if (!key.canReveal) {
      toast.error("This key cannot be revealed yet. Run DB migration and rotate/regenerate key.");
      return;
    }

    try {
      setRevealingKeyId(key.id);
      const response = await apiClient.get<{ id: string; apiKey: string }>(
        `/api/api-keys/${key.id}/unmasked`
      );
      await navigator.clipboard.writeText(response.data.apiKey);
      setCopiedKeyId(key.id);
      setTimeout(() => setCopiedKeyId(null), 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to copy API key";
      toast.error(message);
    } finally {
      setRevealingKeyId(null);
    }
  };

  const handleRegenerateKey = async (key: ApiKeyStageRow) => {
    try {
      setRegeneratingKeyId(key.id);
      const response = await apiClient.post<{ id: string; apiKey: string }>(
        `/api/api-keys/${key.id}/regenerate`
      );
      setSessionPlainKeys((prev) => ({ ...prev, [response.data.id]: response.data.apiKey }));
      await navigator.clipboard.writeText(response.data.apiKey);
      toast.success("API key regenerated and copied to clipboard.");
      await loadApiKeys();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to regenerate API key";
      toast.error(message);
    } finally {
      setRegeneratingKeyId(null);
    }
  };

  const handleCreateKey = async () => {
    const trimmedName = newKeyName.trim();
    if (!trimmedName) {
      toast.error("Enter an API key name.");
      return;
    }

    const selectedEnvironment = environmentOptions.find(
      (option) => option.environmentId === newKeyEnvironmentId
    );
    if (!selectedEnvironment) {
      toast.error("Select an environment.");
      return;
    }

    try {
      setIsCreatingKey(true);
      const response = await apiClient.post<{ id: string; apiKey: string; name: string }>(
        "/api/api-keys",
        {
          projectId: selectedEnvironment.projectId,
          environmentId: selectedEnvironment.environmentId,
          name: trimmedName,
        }
      );

      setSessionPlainKeys((prev) => ({ ...prev, [response.data.id]: response.data.apiKey }));
      await navigator.clipboard.writeText(response.data.apiKey);
      toast.success("API key created and copied to clipboard.");
      setNewKeyName("");
      setIsCreateDialogOpen(false);
      await loadApiKeys();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create API key";
      toast.error(message);
    } finally {
      setIsCreatingKey(false);
    }
  };

  const renderKeyValue = (key: ApiKeyStageRow) => {
    return key.maskedKey || `${key.keyPrefix}****`;
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="rounded-sm border border-border/50 bg-card p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{SETTINGS_COPY.apiKeysTitle}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground sm:text-base">{SETTINGS_COPY.apiKeysSubtitle}</p>
          </div>
          <Button variant="primary" size="sm" className="w-full gap-2 sm:w-auto" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New API Key
          </Button>
        </div>

        {isLoadingKeys && apiKeys.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading API keys...</div>
        ) : keysError && apiKeys.length === 0 ? (
          <div className="py-10 text-center text-sm text-destructive">{keysError}</div>
        ) : apiKeys.length === 0 ? (
          <EmptyStateSimple
            title={SETTINGS_COPY.apiKeysEmptyTitle}
            description={SETTINGS_COPY.apiKeysEmptyDescription}
            icon={KeyRound}
            className="py-10"
          />
        ) : (
          <div className="mt-5 overflow-hidden rounded-sm border border-border/50 px-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Monthly Usage</TableHead>
                  <TableHead className="min-w-[15rem]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="py-4 text-sm font-semibold text-foreground">
                      {key.name}
                    </TableCell>
                    <TableCell className="py-4 text-sm text-muted-foreground">
                      {key.stage}
                    </TableCell>
                    <TableCell className="py-4">
                      <code className="rounded-sm border border-border/40 bg-surface-2/50 px-2.5 py-1.5 text-sm font-mono text-foreground/80">
                        {renderKeyValue(key)}
                      </code>
                    </TableCell>
                    <TableCell className="py-4 text-sm text-muted-foreground">
                      {formatShortDate(key.createdAt)}
                    </TableCell>
                    <TableCell className="py-4 text-sm text-muted-foreground">
                      {SETTINGS_COPY.apiKeysUsagePlaceholder}
                    </TableCell>
                    <TableCell className="min-w-[15rem] py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-w-32 justify-center whitespace-nowrap"
                          onClick={() => handleRegenerateKey(key)}
                          disabled={regeneratingKeyId === key.id}
                        >
                          {regeneratingKeyId === key.id ? (
                            <Spinner className="h-4 w-4 border-2" />
                          ) : (
                            <RefreshCcw className="h-4 w-4" />
                          )}
                          {regeneratingKeyId === key.id ? "Regenerating..." : "Regenerate"}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="min-w-28 justify-center whitespace-nowrap"
                          onClick={() => handleCopyKey(key)}
                          disabled={
                            revealingKeyId === key.id ||
                            (!(key.canReveal || Boolean(sessionPlainKeys[key.id]))) ||
                            regeneratingKeyId === key.id
                          }
                        >
                          <Copy className="h-4 w-4" />
                          {copiedKeyId === key.id
                            ? "Copied"
                            : revealingKeyId === key.id
                              ? "Revealing..."
                              : key.canReveal || Boolean(sessionPlainKeys[key.id])
                                ? "Copy"
                                : "Unavailable"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="rounded-sm border border-border/50 bg-card p-4 sm:p-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{SETTINGS_COPY.endpointsTitle}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground sm:text-base">{SETTINGS_COPY.endpointsSubtitle}</p>
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

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg border-border/60 bg-card">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Choose an environment and set a name. The new key is copied once after creation.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label htmlFor="api-key-name">Key Name</Label>
              <Input
                id="api-key-name"
                placeholder="Production Read Key"
                value={newKeyName}
                onChange={(event) => setNewKeyName(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-key-environment">Environment</Label>
              <Select value={newKeyEnvironmentId} onValueChange={setNewKeyEnvironmentId}>
                <SelectTrigger id="api-key-environment">
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent>
                  {environmentOptions.map((option) => (
                    <SelectItem key={option.environmentId} value={option.environmentId}>
                      {option.projectName} • {option.environmentName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={isCreatingKey}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateKey} disabled={isCreatingKey}>
              {isCreatingKey ? (
                <>
                  <Spinner className="h-4 w-4 border-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Generate Key
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    <div className="rounded-sm border border-border/50 bg-surface-2/30 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="min-w-24 justify-center self-start"
          onClick={handleCopy}
          disabled={value === "-"}
        >
          <Copy className="h-4 w-4" />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="mt-3">
        <Input value={value} readOnly aria-readonly className="h-12 font-mono text-sm" />
      </div>
    </div>
  );
}
