import { Badge } from "@/components/ui/badge";
import { formatCostUsd } from "@/lib/trace-cost";
import { formatDuration } from "@/lib/trace-format";
import { JsonViewer } from "@/components/ui/json-viewer";
import { Brain, CheckCircle, Sparkles, StopCircle, Terminal, User, XCircle } from "lucide-react";
import { Handle, NodeProps, Position } from "reactflow";

// Start Node
export function StartNode() {
  return (
    <div className="flex flex-col items-center">
      <div className="flex h-10 w-24 items-center justify-center rounded-full border-2 border-primary/50 bg-background ">
        <span className="text-xs font-bold uppercase text-primary tracking-widest">START</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary/50" />
    </div>
  );
}

// User Input Node - for user_message events
export function UserInputNode({ data }: NodeProps) {
  // Get content from different possible data properties
  const content = data.contentText || data.content?.text || data.value || "";
  const jsonValue = typeof content === "string" ? content : JSON.stringify(content);

  return (
    <div className="relative w-64 rounded-lg border-2 border-secondary bg-card p-0 transition-all  ">
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <User className="h-3.5 w-3.5 text-blue-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">User Input</span>
        {data.timeSinceStart !== undefined && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            {data.timeSinceStart}ms
          </span>
        )}
      </div>
      <div className="p-3 max-h-24 overflow-auto">
        <JsonViewer value={jsonValue} variant="compact" />
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

// LLM Response Node - for llm_response events
export function LLMResponseNode({ data }: NodeProps) {
  const content = data.contentText || data.content?.text || data.value || "";
  const jsonValue = typeof content === "string" ? content : JSON.stringify(content);
  const model = data.metadata?.model || data.metadataSummary?.model || "";
  const latencyValue = data.metadata?.latencyMs ?? data.metadataSummary?.latency ?? null;
  const latency = typeof latencyValue === "number" ? formatDuration(latencyValue) : latencyValue || "";
  const costUsd = typeof data.metadata?.costUsd === "number"
    ? data.metadata.costUsd
    : (typeof data.metadataSummary?.costUsd === "number" ? data.metadataSummary.costUsd : null);
  const formattedCost = costUsd !== null ? formatCostUsd(costUsd) : null;

  return (
    <div className="relative w-72 rounded-lg border-2 border-secondary bg-card p-0 transition-all">
      <Handle type="target" position={Position.Top}  />
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-purple-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">LLM Response</span>
        </div>
        <div className="flex items-center gap-1">
          {latency && (
            <Badge className="h-4 rounded border border-purple-500/30 bg-purple-500/20 px-1 text-[9px] text-purple-300">
              {latency}
            </Badge>
          )}
          {formattedCost && (
            <Badge className="h-4 rounded border border-purple-500/30 bg-purple-500/10 px-1 text-[9px] text-purple-200">
              {formattedCost}
            </Badge>
          )}
        </div>
      </div>
      <div className="p-3 max-h-24 overflow-auto">
        <JsonViewer value={jsonValue} variant="compact" />
        {model && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            {model}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

// Tool Call Node - for tool_call events
export function ToolCallNode({ data }: NodeProps) {
  const rawContent = data.content;
  let toolName = data.contentPreview
    || data.metadata?.tool
    || data.content?.name
    || data.name
    || "";
  if (!toolName && typeof data.contentText === "string") {
    const nameMatch = data.contentText.match(/^([^(\s]+)\s*\(/);
    toolName = nameMatch ? nameMatch[1] : data.contentText;
  }
  if (!toolName) {
    toolName = "Unknown Tool";
  }

  let arguments_ = data.content?.arguments || data.input;
  if (!arguments_ && typeof rawContent === "string") {
    try {
      arguments_ = JSON.parse(rawContent);
    } catch {
      arguments_ = rawContent;
    }
  } else if (!arguments_ && rawContent && typeof rawContent === "object") {
    arguments_ = rawContent;
  }
  const jsonValue = arguments_
    ? (typeof arguments_ === "string" ? arguments_ : JSON.stringify(arguments_))
    : "";

  return (
    <div className="relative w-72 rounded-lg border-2 border-secondary bg-card p-0  ring-offset-background transition-all">
      <Handle type="target" position={Position.Top}  />
      <div className="flex items-center justify-between border-b  px-3 py-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Tool Call</span>
        </div>
        {data.duration && (
          <span className="text-[10px] text-muted-foreground">
            {formatDuration(data.duration)}
          </span>
        )}
      </div>
      <div className="p-3 space-y-2">
        <div className="font-mono text-sm font-bold text-foreground">
          {toolName}
        </div>
        {arguments_ && (
          <div className="rounded bg-surface-2 p-2 max-h-20 overflow-auto">
            <JsonViewer value={jsonValue} variant="compact" />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

// Tool Result Node - for tool_call_response events
export function ToolResultNode({ data }: NodeProps) {
  const content = data.contentText || data.contentPreview || data.content?.text || data.content?.result || "";
  const jsonValue = typeof content === "string" ? content : JSON.stringify(content);

  return (
    <div className="relative w-72 rounded-lg border-2 border-secondary bg-card p-0 transition-all">
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 border-b  px-3 py-2">
        <CheckCircle className="h-3.5 w-3.5 text-green-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-green-400">Tool Result</span>
        {data.duration && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            {formatDuration(data.duration)}
          </span>
        )}
      </div>
      <div className="p-3 max-h-24 overflow-auto">
        <JsonViewer value={jsonValue} variant="compact" />
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

// Error Node - for error events
export function ErrorNode({ data }: NodeProps) {
  const content = data.contentText || data.content?.error || data.value || "";
  const jsonValue = typeof content === "string" ? content : JSON.stringify(content);

  return (
    <div className="relative w-64 rounded-lg border-2 border-secondary bg-card p-0 transition-all">
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-3 py-2">
        <XCircle className="h-3.5 w-3.5 text-red-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Error</span>
      </div>
      <div className="p-3 max-h-24 overflow-auto">
        <JsonViewer value={jsonValue} variant="compact" />
      </div>
    </div>
  );
}

// Decision Node (legacy alias for LLM Response) - reuses LLMResponseNode styling
export function DecisionNode({ data }: NodeProps) {
  const content = data.contentText || data.content?.text || data.value || "";
  const jsonValue = typeof content === "string" ? content : JSON.stringify(content);
  const model = data.metadata?.model || data.metadataSummary?.model || "";
  const latency = data.metadata?.latencyMs || data.metadataSummary?.latency || "";

  return (
    <div className="relative w-72 rounded-lg border-2 border-purple-500/30 bg-card p-0 shadow-[0_0_15px_rgba(168,85,247,0.1)] transition-all hover:border-purple-500/60">
      <Handle type="target" position={Position.Top} className="!bg-purple-500" />
      <div className="flex items-center justify-between border-b border-purple-500/20 bg-purple-500/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-purple-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Decision</span>
        </div>
        {latency && (
          <Badge className="h-4 rounded border border-purple-500/30 bg-purple-500/20 px-1 text-[9px] text-purple-300">
            {latency}
          </Badge>
        )}
      </div>
      <div className="p-3 max-h-24 overflow-auto">
        <JsonViewer value={jsonValue} variant="compact" />
        {model && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            {model}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500" />
    </div>
  );
}

// Rejected Node - reuses ErrorNode styling
export function RejectedNode({ data }: NodeProps) {
  const content = data.contentText || data.content?.error || data.value || "";
  const jsonValue = typeof content === "string" ? content : JSON.stringify(content);

  return (
    <div className="relative w-64 rounded-lg border-2 border-red-500/30 bg-card p-0 shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all hover:border-red-500/60">
      <Handle type="target" position={Position.Top} className="!bg-red-500" />
      <div className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-3 py-2">
        <XCircle className="h-3.5 w-3.5 text-red-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Rejected</span>
      </div>
      <div className="p-3 max-h-24 overflow-auto">
        <JsonViewer value={jsonValue} variant="compact" />
      </div>
    </div>
  );
}

// End Node
export function EndNode() {
  return (
    <div className="flex flex-col items-center">
      <Handle type="target" position={Position.Top}  />
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary ">
        <StopCircle className="h-6 w-6 text-primary-foreground fill-current" />
      </div>
      <span className="mt-2 text-[10px] font-bold uppercase text-muted-foreground tracking-widest">End</span>
    </div>
  );
}
