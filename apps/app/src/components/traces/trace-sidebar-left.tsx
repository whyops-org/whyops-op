"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { JsonViewer } from "@/components/ui/json-viewer";
import type { TraceDetail, TraceModelBreakdown } from "@/stores/traceDetailStore";
import { formatCostUsd } from "@/lib/trace-cost";
import { formatDuration } from "@/lib/trace-format";
import { getModelsUsed, getToolsUsed, getTraceEventStats } from "@/lib/trace-utils";
import { cn } from "@/lib/utils";
import {
  Bot,
  Calendar,
  Clock,
  Eye,
  Hash,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Terminal,
} from "lucide-react";
import * as React from "react";
import { Streamdown } from "streamdown";

interface TraceSidebarLeftProps {
  trace: TraceDetail;
  isCollapsed: boolean;
  onToggle: () => void;
}

interface ToolInfo {
  name: string;
  inputSchema: unknown | null;
  outputSchema: unknown | null;
}

type SectionKey = "agent" | "stats" | "models" | "tools" | "systemPrompt";

const SECTION_CARD_CLASS = "rounded-sm border border-border/50 bg-card p-3";
const SECTION_TRIGGER_CLASS =
  "mb-2.5 flex w-full items-center justify-between text-xs font-medium text-muted-foreground transition-colors hover:text-foreground";

function buildPromptPreview(prompt: string): string {
  const compact = prompt.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "No system prompt content.";
  }
  return compact.length > 90 ? `${compact.slice(0, 90)}…` : compact;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseSchemaValue(value: unknown): unknown | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  return value;
}

function pickFirstSchema(...values: unknown[]): unknown | null {
  for (const candidate of values) {
    const parsed = parseSchemaValue(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

function getToolSchemas(tool: Record<string, unknown>): { inputSchema: unknown | null; outputSchema: unknown | null } {
  const fn = isRecord(tool.function) ? tool.function : null;
  const input = isRecord(tool.input) ? tool.input : null;
  const output = isRecord(tool.output) ? tool.output : null;
  const fnInput = fn && isRecord(fn.input) ? fn.input : null;
  const fnOutput = fn && isRecord(fn.output) ? fn.output : null;

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

  return { inputSchema, outputSchema };
}

function extractConfiguredTools(tools: unknown[] | undefined): ToolInfo[] {
  if (!Array.isArray(tools)) {
    return [];
  }

  const toolMap = new Map<string, ToolInfo>();

  tools.forEach((tool) => {
    if (typeof tool === "string") {
      const value = asText(tool);
      if (value && !toolMap.has(value)) {
        toolMap.set(value, {
          name: value,
          inputSchema: null,
          outputSchema: null,
        });
      }
      return;
    }

    if (!isRecord(tool)) {
      return;
    }

    const directName = asText(tool.name);
    if (directName) {
      const schemas = getToolSchemas(tool);
      const previous = toolMap.get(directName);
      toolMap.set(directName, {
        name: directName,
        inputSchema: previous?.inputSchema ?? schemas.inputSchema,
        outputSchema: previous?.outputSchema ?? schemas.outputSchema,
      });
      return;
    }

    const nestedFunction = tool.function;
    if (isRecord(nestedFunction)) {
      const functionName = asText(nestedFunction.name);
      if (functionName) {
        const schemas = getToolSchemas(tool);
        const previous = toolMap.get(functionName);
        toolMap.set(functionName, {
          name: functionName,
          inputSchema: previous?.inputSchema ?? schemas.inputSchema,
          outputSchema: previous?.outputSchema ?? schemas.outputSchema,
        });
      }
    }
  });

  return Array.from(toolMap.values());
}

function toJsonViewerValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  const serialized = JSON.stringify(value, null, 2);
  return typeof serialized === "string" ? serialized : "null";
}

function SchemaPanel({ title, value, emptyText }: { title: string; value: unknown | null; emptyText: string }) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        {title}
      </p>
      {value !== null ? (
        <JsonViewer value={toJsonViewerValue(value)} className="max-w-full" />
      ) : (
        <div className="rounded-sm border border-border/60 bg-surface-2/30 p-3 text-xs text-muted-foreground">
          {emptyText}
        </div>
      )}
    </div>
  );
}

function ToolSchemaDialog({ tool }: { tool: ToolInfo }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-surface-2/40"
          aria-label={`View schemas for ${tool.name}`}
        >
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl border-border/60 bg-card p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="text-sm font-semibold text-foreground">
            {tool.name}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Input and output schema for this tool.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
            <SchemaPanel title="Input Schema" value={tool.inputSchema} emptyText="No input schema available." />
            <SchemaPanel title="Output Schema" value={tool.outputSchema} emptyText="No output schema available." />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SystemPromptDialog({ prompt }: { prompt: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-surface-2/40"
          aria-label="View system prompt"
        >
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl border-border/60 bg-card p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="text-sm font-semibold text-foreground">
            System Prompt
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Full system prompt configured for this trace.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="rounded-sm border border-border/60 bg-surface-2/30 p-3">
            <div className="text-xs text-foreground">
              <Streamdown>{prompt}</Streamdown>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CollapsedSidebarItem({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-border/60 bg-surface-2/30" title={title}>
      {icon}
    </div>
  );
}

interface SidebarSectionProps {
  id: SectionKey;
  label: string;
  icon: React.ReactNode;
  openSections: SectionKey[];
  onToggle: (section: SectionKey) => void;
  count?: number;
  children: React.ReactNode;
}

function SidebarSection({
  id,
  label,
  icon,
  openSections,
  onToggle,
  count,
  children,
}: SidebarSectionProps) {
  const isOpen = openSections.includes(id);
  const title = count !== undefined ? `${label} (${count})` : label;

  return (
    <div className={SECTION_CARD_CLASS}>
      <button onClick={() => onToggle(id)} className={SECTION_TRIGGER_CLASS}>
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
      </button>
      {isOpen ? children : null}
    </div>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  mono?: boolean;
  title?: string;
}

function InfoRow({ label, value, icon, mono = false, title }: InfoRowProps) {
  return (
    <div>
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </label>
      <p
        className={cn(
          "text-xs text-foreground",
          mono ? "truncate font-mono" : "text-sm font-medium"
        )}
        title={title}
      >
        {value}
      </p>
    </div>
  );
}

function StatItem({ label, value, isError = false }: { label: string; value: string; isError?: boolean }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <p className={cn("text-lg font-semibold", isError ? "text-destructive" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

function ModelBadgeItem({ model }: { model: string }) {
  return (
    <Badge className="border-border/60 bg-surface-2/40 font-mono text-xs text-foreground">
      {model}
    </Badge>
  );
}

function ModelBreakdownItem({ breakdown }: { breakdown: TraceModelBreakdown }) {
  return (
    <div className="rounded-sm border border-border/40 bg-card px-3 py-2.5 text-xs">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono font-medium text-foreground" title={breakdown.model}>
          {breakdown.model}
        </span>
        {breakdown.isLastModel && (
          <span className="shrink-0 rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            last
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-muted-foreground">
        <span>{breakdown.totalTokens.toLocaleString()} tokens</span>
        {breakdown.totalCost > 0 && (
          <span className="tabular-nums text-foreground">{formatCostUsd(breakdown.totalCost)}</span>
        )}
      </div>
    </div>
  );
}

function ToolListItem({ tool }: { tool: ToolInfo }) {
  return (
    <div className="flex items-center gap-2 rounded-sm border border-border/40 bg-surface-2/20 px-2.5 py-2 text-xs">
      <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-mono text-foreground" title={tool.name}>
        {tool.name}
      </span>
      <ToolSchemaDialog tool={tool} />
    </div>
  );
}

function SystemPromptPreviewRow({ prompt }: { prompt: string }) {
  return (
    <div className="flex items-center gap-2 rounded-sm border border-border/40 bg-surface-2/20 px-2.5 py-2 text-xs">
      <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-muted-foreground" title={prompt}>
        {buildPromptPreview(prompt)}
      </span>
      <SystemPromptDialog prompt={prompt} />
    </div>
  );
}

export function TraceSidebarLeft({ trace, isCollapsed, onToggle }: TraceSidebarLeftProps) {
  const [openSections, setOpenSections] = React.useState<SectionKey[]>([
    "agent",
    "stats",
    "models",
    "tools",
    "systemPrompt",
  ]);

  const toggleSection = (section: SectionKey) => {
    setOpenSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  // Calculate stats from events
  const stats = trace.events ? getTraceEventStats(trace.events) : null;
  // Prefer backend-computed model breakdown; fall back to event-derived model names
  const modelBreakdowns = trace.models && trace.models.length > 0 ? trace.models : null;
  const models = modelBreakdowns
    ? modelBreakdowns.map((m) => m.model)
    : (trace.events ? getModelsUsed(trace.events) : []);
  const tools = React.useMemo(() => {
    const configuredTools = extractConfiguredTools(trace.tools);
    const eventTools = trace.events ? getToolsUsed(trace.events) : [];
    const toolMap = new Map<string, ToolInfo>();

    configuredTools.forEach((tool) => {
      toolMap.set(tool.name, tool);
    });

    eventTools.forEach((name) => {
      if (!toolMap.has(name)) {
        toolMap.set(name, {
          name,
          inputSchema: null,
          outputSchema: null,
        });
      }
    });

    return Array.from(toolMap.values());
  }, [trace.tools, trace.events]);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const agentRows = [
    {
      key: "name",
      label: "Name",
      icon: <Sparkles className="h-3 w-3" />,
      value: trace.entityName || "Unknown",
      mono: false,
    },
    {
      key: "traceId",
      label: "Trace ID",
      icon: <Hash className="h-3 w-3" />,
      value: `${trace.threadId.substring(0, 16)}...`,
      mono: true,
      title: trace.threadId,
    },
    {
      key: "started",
      label: "Started",
      icon: <Calendar className="h-3 w-3" />,
      value: trace.firstEventTimestamp ? formatTimestamp(trace.firstEventTimestamp) : "N/A",
      mono: true,
    },
  ];

  const statsItems = stats
    ? [
        { key: "events", label: "Events", value: String(stats.totalEvents) },
        { key: "duration", label: "Duration", value: formatDuration(trace.duration) },
        { key: "llmCalls", label: "LLM Calls", value: String(stats.llmCalls) },
        { key: "toolCalls", label: "Tool Calls", value: String(stats.toolCalls) },
        { key: "tokens", label: "Tokens", value: stats.totalTokens.toLocaleString() },
        { key: "errors", label: "Errors", value: String(stats.errors), isError: stats.errors > 0 },
      ]
    : [];

  if (isCollapsed) {
    const collapsedItems = [
      { key: "agent", title: "Agent", icon: <Bot className="h-4 w-4 text-primary" /> },
      { key: "stats", title: "Stats", icon: <Clock className="h-4 w-4 text-muted-foreground" /> },
      { key: "tools", title: "Tools", icon: <Terminal className="h-4 w-4 text-muted-foreground" /> },
    ];

    return (
      <div className="flex w-[52px] flex-col items-center border-r border-border/50 bg-background py-4 transition-all duration-300">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="mb-4 h-8 w-8 p-0 hover:bg-surface-2/60"
        >
          <PanelLeftOpen className="h-4 w-4 text-muted-foreground" />
        </Button>
        <div className="flex flex-col gap-4">
          {collapsedItems.map((item) => (
            <CollapsedSidebarItem key={item.key} title={item.title} icon={item.icon} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 overflow-y-auto border-r border-border/50 bg-background transition-all duration-300">
      <div className="flex h-11 items-center justify-between border-b border-border/50 px-4">
        <h3 className="text-xs font-medium text-muted-foreground">
          Agent Info
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-6 w-6 p-0 hover:bg-surface-2/60"
        >
          <PanelLeftClose className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>

      <div className="flex-1 space-y-3.5 overflow-y-auto p-4">
        <SidebarSection
          id="agent"
          label="Agent"
          icon={<Bot className="h-3.5 w-3.5" />}
          openSections={openSections}
          onToggle={toggleSection}
        >
          <div className="space-y-3">
            {agentRows.map((row) => (
              <InfoRow
                key={row.key}
                label={row.label}
                value={row.value}
                icon={row.icon}
                mono={row.mono}
                title={row.title}
              />
            ))}
          </div>
        </SidebarSection>

        {stats && (
          <SidebarSection
            id="stats"
            label="Stats"
            icon={<Clock className="h-3.5 w-3.5" />}
            openSections={openSections}
            onToggle={toggleSection}
          >
            <div className="grid grid-cols-2 gap-3">
              {statsItems.map((item) => (
                <StatItem
                  key={item.key}
                  label={item.label}
                  value={item.value}
                  isError={item.isError}
                />
              ))}
            </div>
          </SidebarSection>
        )}

        {models.length > 0 && (
          <SidebarSection
            id="models"
            label="Models"
            icon={<Sparkles className="h-3.5 w-3.5" />}
            count={models.length}
            openSections={openSections}
            onToggle={toggleSection}
          >
            <div className="space-y-2">
              {modelBreakdowns
                ? modelBreakdowns.map((breakdown) => (
                    <ModelBreakdownItem key={breakdown.model} breakdown={breakdown} />
                  ))
                : models.map((model) => (
                    <ModelBadgeItem key={model} model={model} />
                  ))}
            </div>
          </SidebarSection>
        )}

        {tools.length > 0 && (
          <SidebarSection
            id="tools"
            label="Tools"
            icon={<Terminal className="h-3.5 w-3.5" />}
            count={tools.length}
            openSections={openSections}
            onToggle={toggleSection}
          >
            <div className="space-y-2">
              {tools.map((tool) => (
                <ToolListItem key={tool.name} tool={tool} />
              ))}
            </div>
          </SidebarSection>
        )}

        {trace.systemPrompt && (
          <SidebarSection
            id="systemPrompt"
            label="System Prompt"
            icon={<Sparkles className="h-3.5 w-3.5" />}
            openSections={openSections}
            onToggle={toggleSection}
          >
            <SystemPromptPreviewRow prompt={trace.systemPrompt} />
          </SidebarSection>
        )}
      </div>
    </div>
  );
}
