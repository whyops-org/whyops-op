"use client";

import { useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { JsonViewer } from "@/components/ui/json-viewer";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api-client";
import { useAgentsStore } from "@/stores/agentsStore";
import { useConfigStore } from "@/stores/configStore";
import { Streamdown } from "streamdown";

interface AgentVersionConfigTabProps {
  agentId: string;
  preferredVersionId?: string;
}

interface EntityVersionSummary {
  id: string;
  hash?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AgentVersionIdsResponse {
  success: boolean;
  agentId: string;
  versionIds?: string[];
  versions: EntityVersionSummary[];
}

interface VersionDetail {
  id: string;
  agentId?: string;
  name: string;
  hash: string;
  samplingRate: number;
  systemPrompt: string;
  tools: unknown[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface AgentVersionDetailResponse {
  success: boolean;
  version: VersionDetail;
}

interface NormalizedTool {
  key: string;
  name: string;
  description: string;
  inputSchema: unknown | null;
  outputSchema: unknown | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseSchemaValue(value: unknown): unknown | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function pickFirstSchema(...values: unknown[]): unknown | null {
  for (const value of values) {
    const parsed = parseSchemaValue(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function normalizeTools(tools: unknown[]): NormalizedTool[] {
  if (!Array.isArray(tools)) return [];

  return tools
    .map((tool, index) => {
      if (!isRecord(tool)) return null;

      const fn = isRecord(tool.function) ? tool.function : null;
      const input = isRecord(tool.input) ? tool.input : null;
      const output = isRecord(tool.output) ? tool.output : null;
      const fnInput = fn && isRecord(fn.input) ? fn.input : null;
      const fnOutput = fn && isRecord(fn.output) ? fn.output : null;

      const name =
        asNonEmptyString(tool.name) ||
        (fn ? asNonEmptyString(fn.name) : null) ||
        `Tool ${index + 1}`;

      const description =
        asNonEmptyString(tool.description) ||
        (fn ? asNonEmptyString(fn.description) : null) ||
        "No description provided.";

      const inputSchema = pickFirstSchema(
        tool.inputSchema,
        tool.input_schema,
        tool.parameters,
        input?.schema,
        fn?.parameters,
        fnInput?.schema
      );

      const outputSchema = pickFirstSchema(
        tool.outputSchema,
        tool.output_schema,
        tool.responseSchema,
        tool.response_schema,
        tool.returns,
        output?.schema,
        fn?.outputSchema,
        fn?.output_schema,
        fn?.returns,
        fnOutput?.schema
      );

      return {
        key: `${name}-${index}`,
        name,
        description,
        inputSchema,
        outputSchema,
      } satisfies NormalizedTool;
    })
    .filter((tool): tool is NormalizedTool => Boolean(tool));
}

function toJsonViewerValue(value: unknown): string {
  if (typeof value === "string") return value;
  const serialized = JSON.stringify(value, null, 2);
  return typeof serialized === "string" ? serialized : "null";
}

function formatVersionLabel(version: EntityVersionSummary): string {
  if (!version.createdAt) {
    return version.id;
  }
  return `${version.id.slice(0, 8)} • ${new Date(version.createdAt).toLocaleDateString()}`;
}

function SchemaBlock({
  title,
  schema,
}: {
  title: string;
  schema: unknown | null;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-background/60 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground">{title}</p>
        <Badge className="text-[10px]">{schema !== null ? "Available" : "Empty"}</Badge>
      </div>
      <div className="rounded-sm border border-border/60 bg-surface-2/20 p-2">
        {schema !== null ? (
          <JsonViewer value={toJsonViewerValue(schema)} variant="compact" />
        ) : (
          <p className="text-xs text-muted-foreground">No schema provided.</p>
        )}
      </div>
    </div>
  );
}

export function AgentVersionConfigTab({ agentId, preferredVersionId }: AgentVersionConfigTabProps) {
  const config = useConfigStore((state) => state.config);
  const apiKey = useAgentsStore((state) => state.apiKey);

  const [versions, setVersions] = useState<EntityVersionSummary[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [versionDetail, setVersionDetail] = useState<VersionDetail | null>(null);
  const [selectedToolKey, setSelectedToolKey] = useState<string>("");
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadVersions = async () => {
      if (!config?.analyseBaseUrl || !agentId) return;

      setIsLoadingVersions(true);
      setError(null);

      try {
        const response = await apiClient.get<AgentVersionIdsResponse>(
          `${config.analyseBaseUrl}/entities/${agentId}/version-ids`,
          {
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
          }
        );

        if (!active) return;

        const nextVersions = response.data.versions?.length
          ? response.data.versions
          : (response.data.versionIds || []).map((id) => ({ id }));
        setVersions(nextVersions);

        if (nextVersions.length === 0) {
          setSelectedVersionId("");
          setVersionDetail(null);
          return;
        }

        const preferredExists = preferredVersionId && nextVersions.some((version) => version.id === preferredVersionId);
        const initialSelection = preferredExists
          ? preferredVersionId!
          : nextVersions[0].id;

        setSelectedVersionId((prev) => {
          if (prev && nextVersions.some((version) => version.id === prev)) {
            return prev;
          }
          return initialSelection;
        });
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load entity versions");
      } finally {
        if (active) {
          setIsLoadingVersions(false);
        }
      }
    };

    loadVersions();

    return () => {
      active = false;
    };
  }, [apiKey, config?.analyseBaseUrl, agentId, preferredVersionId]);

  useEffect(() => {
    let active = true;

    const loadVersionDetail = async () => {
      if (!config?.analyseBaseUrl || !selectedVersionId) return;

      setIsLoadingDetail(true);
      setError(null);

      try {
        const response = await apiClient.get<AgentVersionDetailResponse>(
          `${config.analyseBaseUrl}/entities/versions/${selectedVersionId}`,
          {
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
          }
        );
        if (!active) return;
        setVersionDetail(response.data.version);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load entity version detail");
      } finally {
        if (active) {
          setIsLoadingDetail(false);
        }
      }
    };

    loadVersionDetail();

    return () => {
      active = false;
    };
  }, [apiKey, config?.analyseBaseUrl, selectedVersionId]);

  const normalizedTools = useMemo(
    () => normalizeTools(versionDetail?.tools || []),
    [versionDetail?.tools]
  );
  const selectedTool = useMemo(
    () => normalizedTools.find((tool) => tool.key === selectedToolKey) ?? null,
    [normalizedTools, selectedToolKey]
  );

  useEffect(() => {
    if (normalizedTools.length === 0) {
      setSelectedToolKey("");
      return;
    }

    if (!selectedToolKey || !normalizedTools.some((tool) => tool.key === selectedToolKey)) {
      setSelectedToolKey(normalizedTools[0].key);
    }
  }, [normalizedTools, selectedToolKey]);

  if (error) {
    return (
      <Card className="border-border/30 bg-card p-5 text-sm text-destructive">
        {error}
      </Card>
    );
  }

  return (
    <Card className="border-border/30 bg-card p-5">
      <div className="mb-4 flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">Entity Version</Label>
        <Select
          value={selectedVersionId}
          onValueChange={setSelectedVersionId}
          disabled={isLoadingVersions || versions.length === 0}
        >
          <SelectTrigger className="w-full md:w-[24rem]">
            <SelectValue
              placeholder={isLoadingVersions ? "Loading versions..." : "Select entity version"}
            />
          </SelectTrigger>
          <SelectContent>
            {versions.map((version) => (
              <SelectItem key={version.id} value={version.id}>
                {formatVersionLabel(version)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoadingDetail ? (
        <div className="flex min-h-[14rem] items-center justify-center">
          <Spinner className="h-6 w-6 border-2 text-primary" />
        </div>
      ) : versionDetail ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
          <div className="rounded-sm border border-border/60 bg-surface-2/20 p-4">
            <div className="mb-3 space-y-0.5">
              <p className="text-sm font-semibold text-foreground">System Prompt</p>
              <p className="text-xs text-muted-foreground">
                Version ID: <span className="font-mono">{versionDetail.id}</span>
              </p>
            </div>
            {versionDetail.systemPrompt?.trim() ? (
              <div className="prose prose-sm max-w-none text-foreground dark:prose-invert">
                <Streamdown>{versionDetail.systemPrompt}</Streamdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No system prompt found for this version.</p>
            )}
          </div>

          <div className="rounded-sm border border-border/60 bg-surface-2/20 p-4">
            <div className="mb-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Tools</p>
                <Badge>{normalizedTools.length} configured</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Browse tools and inspect their schemas.
              </p>
            </div>

            {normalizedTools.length > 0 ? (
              <div className="space-y-3">
                <div className="rounded-md border border-border/60 bg-background/40 p-2">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {normalizedTools.map((tool, index) => {
                      const isActive = selectedToolKey === tool.key;
                      return (
                        <Button
                          key={tool.key}
                          type="button"
                          variant={isActive ? "outline" : "ghost"}
                          size="sm"
                          className="h-auto shrink-0 rounded-md px-3 py-2"
                          onClick={() => setSelectedToolKey(tool.key)}
                        >
                          <span className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="max-w-[14rem] truncate text-xs font-semibold" title={tool.name}>
                              {tool.name}
                            </span>
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-md border border-border/60 bg-background/50 p-3">
                  {selectedTool ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">{selectedTool.name}</p>
                          <div className="flex items-center gap-1">
                            <Badge className="text-[10px]">IN {selectedTool.inputSchema ? "1" : "0"}</Badge>
                            <Badge className="text-[10px]">OUT {selectedTool.outputSchema ? "1" : "0"}</Badge>
                          </div>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {selectedTool.description}
                        </p>
                      </div>
                      <Tabs key={selectedTool.key} defaultValue="input">
                        <TabsList className="w-full">
                          <TabsTrigger value="input">Input</TabsTrigger>
                          <TabsTrigger value="output">Output</TabsTrigger>
                        </TabsList>
                        <TabsContent value="input">
                          <SchemaBlock title="Input Schema" schema={selectedTool.inputSchema} />
                        </TabsContent>
                        <TabsContent value="output">
                          <SchemaBlock title="Output Schema" schema={selectedTool.outputSchema} />
                        </TabsContent>
                      </Tabs>
                    </div>
                  ) : (
                    <div className="flex min-h-[12rem] items-center justify-center rounded-md border border-dashed border-border/60 bg-surface-2/20 p-4">
                      <p className="text-xs text-muted-foreground">Select a tool to inspect details.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[10rem] items-center justify-center rounded-md border border-dashed border-border/60 bg-surface-2/20 p-4">
                <p className="text-sm text-muted-foreground">No tools found for this version.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Select a version to inspect its prompt and tools.</p>
      )}
    </Card>
  );
}
