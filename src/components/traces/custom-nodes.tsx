import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Brain, Play, User, Terminal, XCircle, StopCircle, CheckCircle, Sparkles, Clock } from "lucide-react";
import { Handle, Position, NodeProps } from "reactflow";

// Start Node
export function StartNode({ data }: NodeProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex h-10 w-24 items-center justify-center rounded-full border-2 border-primary/50 bg-background shadow-[0_0_15px_rgba(24,199,165,0.3)]">
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

  return (
    <div className="relative w-64 rounded-lg border-2 border-blue-500/30 bg-card p-0 shadow-lg transition-all hover:border-blue-500/60 hover:shadow-[0_0_20px_rgba(59,130,246,0.2)]">
      <Handle type="target" position={Position.Top} className="!bg-blue-500" />
      <div className="flex items-center gap-2 border-b border-blue-500/20 bg-blue-500/10 px-3 py-2">
        <User className="h-3.5 w-3.5 text-blue-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">User Input</span>
        {data.timeSinceStart !== undefined && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            {data.timeSinceStart}ms
          </span>
        )}
      </div>
      <div className="p-3 max-h-24 overflow-hidden">
        <div className="font-mono text-xs text-foreground line-clamp-3">
          {typeof content === 'string' ? content : JSON.stringify(content)}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500" />
    </div>
  );
}

// LLM Response Node - for llm_response events
export function LLMResponseNode({ data }: NodeProps) {
  const content = data.contentText || data.content?.text || data.value || "";
  const model = data.metadata?.model || data.metadataSummary?.model || "";
  const latency = data.metadata?.latencyMs || data.metadataSummary?.latency || "";

  return (
    <div className="relative w-72 rounded-lg border-2 border-purple-500/30 bg-card p-0 shadow-[0_0_15px_rgba(168,85,247,0.1)] transition-all hover:border-purple-500/60">
      <Handle type="target" position={Position.Top} className="!bg-purple-500" />
      <div className="flex items-center justify-between border-b border-purple-500/20 bg-purple-500/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-purple-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">LLM Response</span>
        </div>
        {latency && (
          <Badge className="h-4 rounded border border-purple-500/30 bg-purple-500/20 px-1 text-[9px] text-purple-300">
            {latency}
          </Badge>
        )}
      </div>
      <div className="p-3 max-h-24 overflow-hidden">
        <div className="font-mono text-xs text-foreground line-clamp-3">
          {typeof content === 'string' ? content : JSON.stringify(content)}
        </div>
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

// Tool Call Node - for tool_call events
export function ToolCallNode({ data }: NodeProps) {
  const toolName = data.content?.name || data.name || "";
  const arguments_ = data.content?.arguments || data.input || {};

  return (
    <div className="relative w-72 rounded-lg border-2 border-amber-500/30 bg-card p-0 shadow-[0_0_20px_rgba(245,158,11,0.15)] ring-offset-background transition-all hover:border-amber-500/60">
      <Handle type="target" position={Position.Top} className="!bg-amber-500" />
      <div className="flex items-center justify-between border-b border-amber-500/20 bg-amber-500/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Tool Call</span>
        </div>
        {data.duration && (
          <span className="text-[10px] text-muted-foreground">
            {data.duration}ms
          </span>
        )}
      </div>
      <div className="p-3 space-y-2">
        <div className="font-mono text-sm font-bold text-foreground">
          {toolName}
        </div>
        {arguments_ && Object.keys(arguments_).length > 0 && (
          <div className="rounded bg-surface-2 p-2 font-mono text-xs text-muted-foreground break-all max-h-20 overflow-auto">
            {JSON.stringify(arguments_, null, 2)}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500" />
    </div>
  );
}

// Tool Result Node - for tool_call_response events
export function ToolResultNode({ data }: NodeProps) {
  const content = data.contentText || data.content?.text || data.content?.result || "";

  return (
    <div className="relative w-72 rounded-lg border-2 border-green-500/30 bg-card p-0 shadow-[0_0_15px_rgba(34,197,94,0.1)] transition-all hover:border-green-500/60">
      <Handle type="target" position={Position.Top} className="!bg-green-500" />
      <div className="flex items-center gap-2 border-b border-green-500/20 bg-green-500/10 px-3 py-2">
        <CheckCircle className="h-3.5 w-3.5 text-green-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-green-400">Tool Result</span>
        {data.duration && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            {data.duration}ms
          </span>
        )}
      </div>
      <div className="p-3 max-h-24 overflow-hidden">
        <div className="font-mono text-xs text-foreground line-clamp-4">
          {typeof content === 'string' ? content : JSON.stringify(content)}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-green-500" />
    </div>
  );
}

// Error Node - for error events
export function ErrorNode({ data }: NodeProps) {
  const content = data.contentText || data.content?.error || data.value || "";

  return (
    <div className="relative w-64 rounded-lg border-2 border-red-500/30 bg-card p-0 shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all hover:border-red-500/60">
      <Handle type="target" position={Position.Top} className="!bg-red-500" />
      <div className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-3 py-2">
        <XCircle className="h-3.5 w-3.5 text-red-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Error</span>
      </div>
      <div className="p-3 max-h-24 overflow-hidden">
        <div className="font-mono text-xs text-red-400 line-clamp-3">
          {typeof content === 'string' ? content : JSON.stringify(content)}
        </div>
      </div>
    </div>
  );
}

// Decision Node (legacy alias for LLM Response) - reuses LLMResponseNode styling
export function DecisionNode({ data }: NodeProps) {
  const content = data.contentText || data.content?.text || data.value || "";
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
      <div className="p-3 max-h-24 overflow-hidden">
        <div className="font-mono text-xs text-foreground line-clamp-3">
          {typeof content === 'string' ? content : JSON.stringify(content)}
        </div>
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

  return (
    <div className="relative w-64 rounded-lg border-2 border-red-500/30 bg-card p-0 shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all hover:border-red-500/60">
      <Handle type="target" position={Position.Top} className="!bg-red-500" />
      <div className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-3 py-2">
        <XCircle className="h-3.5 w-3.5 text-red-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Rejected</span>
      </div>
      <div className="p-3 max-h-24 overflow-hidden">
        <div className="font-mono text-xs text-red-400 line-clamp-3">
          {typeof content === 'string' ? content : JSON.stringify(content)}
        </div>
      </div>
    </div>
  );
}

// End Node
export function EndNode({ data }: NodeProps) {
  return (
    <div className="flex flex-col items-center">
      <Handle type="target" position={Position.Top} className="!bg-primary/50" />
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-[0_0_15px_rgba(24,199,165,0.5)]">
        <StopCircle className="h-6 w-6 text-primary-foreground fill-current" />
      </div>
      <span className="mt-2 text-[10px] font-bold uppercase text-muted-foreground tracking-widest">End</span>
    </div>
  );
}
