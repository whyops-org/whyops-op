import type { JudgePatch } from "@/stores/judgeStore";
import type { PatchSource, PatchSourceResolution, PromptAwareDiff } from "./types";

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export function formatScore(score: number): string {
  if (!Number.isFinite(score) || score < 0) {
    return "N/A";
  }

  return String(Math.round(score * 100));
}

export function getScoreClass(score: number): string {
  if (!Number.isFinite(score) || score < 0) {
    return "text-muted-foreground";
  }
  if (score >= 0.7) {
    return "text-primary";
  }
  if (score >= 0.5) {
    return "text-warning";
  }
  return "text-destructive";
}

export function toSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

interface CheckpointToastCopy {
  title: string;
  description: string;
}

const CHECKPOINT_STATUS_LABELS: Record<string, string> = {
  started: "Started",
  completed: "Completed",
  failed: "Failed",
  skipped: "Skipped",
  running: "Running",
  queued: "Queued",
};

const CHECKPOINT_STATUS_SENTENCE_PREFIX: Record<string, string> = {
  started: "Started evaluating",
  completed: "Finished evaluating",
  failed: "Evaluation failed for",
  skipped: "Skipped",
  running: "Evaluating",
  queued: "Queued",
};

const CHECKPOINT_TOKEN_LABELS: Record<string, string> = {
  dimension: "Dimension",
  prompt_quality: "Prompt Quality",
  step_correctness: "Step Correctness",
  tool_choice: "Tool Choice",
  tool_description: "Tool Description",
  cost_efficiency: "Cost Efficiency",
  block_eval: "Block Evaluation",
  span_eval: "Span Evaluation",
  score: "Score",
  issue: "Issue",
  issues: "Issues",
  patch: "Patch",
  patches: "Patches",
  summary: "Summary",
};

export function formatCheckpointToastCopy(
  checkpointKey: string,
  sequence: number
): CheckpointToastCopy {
  const rawParts = checkpointKey
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);

  const compactParts: string[] = [];
  for (const part of rawParts) {
    if (compactParts[compactParts.length - 1] !== part) {
      compactParts.push(part);
    }
  }

  const parts = compactParts[0] === "dimension" ? compactParts.slice(1) : compactParts;

  let statusLabel: string | null = null;
  if (parts.length > 0) {
    const maybeStatus = parts[parts.length - 1].toLowerCase();
    if (CHECKPOINT_STATUS_LABELS[maybeStatus]) {
      statusLabel = CHECKPOINT_STATUS_LABELS[maybeStatus];
      parts.pop();
    }
  }

  const readablePath = parts
    .map((part) => CHECKPOINT_TOKEN_LABELS[part] || humanizeCheckpointToken(part))
    .filter(Boolean);

  const pathLabel = readablePath.length > 0 ? readablePath.join(", ") : "judge analysis";
  const clippedPath =
    pathLabel.length > 88 ? `${pathLabel.slice(0, 85).trimEnd()}...` : pathLabel;
  const normalizedStatus = statusLabel?.toLowerCase();
  const sentencePrefix = normalizedStatus
    ? CHECKPOINT_STATUS_SENTENCE_PREFIX[normalizedStatus]
    : "Evaluating";

  return {
    title: `${sentencePrefix} ${clippedPath}.`,
    description: `Checkpoint ${sequence}`,
  };
}

export function buildPromptAwarePatchDiff(
  sourceText: string,
  patch: JudgePatch,
  options?: { sourceLabel?: string }
): PromptAwareDiff {
  const prompt = normalizeText(sourceText);
  const original = normalizeText(patch.original);
  const suggested = normalizeText(patch.suggested);
  const sourceLabel = options?.sourceLabel || "Patch";

  if (!prompt || !original) {
    return {
      oldValue: original || "",
      newValue: suggested || "",
      leftTitle: `Original ${sourceLabel}`,
      rightTitle: `Suggested ${sourceLabel}`,
      foundInPrompt: false,
    };
  }

  const match = findSnippetInPrompt(prompt, original);

  if (!match) {
    return {
      oldValue: original,
      newValue: suggested,
      leftTitle: `Original ${sourceLabel}`,
      rightTitle: `Suggested ${sourceLabel}`,
      foundInPrompt: false,
    };
  }

  const contextRadius = 280;
  const contextStart = Math.max(0, match.start - contextRadius);
  const contextEnd = Math.min(prompt.length, match.end + contextRadius);
  const originalContext = prompt.slice(contextStart, contextEnd);
  const localStart = match.start - contextStart;
  const localEnd = localStart + match.matchedText.length;

  const updatedContext = `${originalContext.slice(0, localStart)}${suggested}${originalContext.slice(localEnd)}`;

  return {
    oldValue: originalContext,
    newValue: updatedContext,
    leftTitle: `Original ${sourceLabel} Context`,
    rightTitle: `Suggested ${sourceLabel} Context`,
    foundInPrompt: true,
  };
}

interface PatchedPromptBuildResult {
  patchedText: string;
  appliedCount: number;
  totalCount: number;
  unappliedPatches: {
    index: number;
    location?: string;
    reason: "missing_original" | "not_found_in_source";
    originalPreview: string;
  }[];
}

export function buildPatchedTextWithAllPatches(
  sourceText: string,
  patches: JudgePatch[]
): PatchedPromptBuildResult {
  const normalizedPrompt = normalizeText(sourceText);
  if (!normalizedPrompt || patches.length === 0) {
    return {
      patchedText: normalizedPrompt,
      appliedCount: 0,
      totalCount: patches.length,
      unappliedPatches: [],
    };
  }

  let workingPrompt = normalizedPrompt;
  let appliedCount = 0;
  const unappliedPatches: PatchedPromptBuildResult["unappliedPatches"] = [];

  for (let index = 0; index < patches.length; index += 1) {
    const patch = patches[index];
    const original = normalizeText(patch.original);
    const suggested = normalizeText(patch.suggested);
    if (!original) {
      unappliedPatches.push({
        index,
        location: patch.location,
        reason: "missing_original",
        originalPreview: "(Patch missing original text)",
      });
      continue;
    }

    const match = findSnippetInPrompt(workingPrompt, original);
    if (!match) {
      unappliedPatches.push({
        index,
        location: patch.location,
        reason: "not_found_in_source",
        originalPreview: original.slice(0, 120),
      });
      continue;
    }

    workingPrompt = `${workingPrompt.slice(0, match.start)}${suggested}${workingPrompt.slice(match.end)}`;
    appliedCount += 1;
  }

  return {
    patchedText: workingPrompt,
    appliedCount,
    totalCount: patches.length,
    unappliedPatches,
  };
}

export function buildPatchSources(input: { systemPrompt?: string; tools?: unknown[] }): PatchSource[] {
  const sources: PatchSource[] = [];
  const seen = new Set<string>();

  const pushSource = (source: PatchSource) => {
    const text = normalizeText(source.text).trim();
    if (!text) return;
    if (seen.has(source.id)) return;
    seen.add(source.id);
    sources.push({ ...source, text });
  };

  if (input.systemPrompt?.trim()) {
    pushSource({
      id: "system_prompt",
      title: "System Prompt",
      text: input.systemPrompt,
      kind: "system_prompt",
    });
  }

  const tools = Array.isArray(input.tools) ? input.tools : [];
  for (let index = 0; index < tools.length; index += 1) {
    const tool = tools[index];
    if (typeof tool === "string") {
      const rawTool = tool.trim();
      if (rawTool) {
        const toolName = `Tool ${index + 1}`;
        pushSource({
          id: `tool:${toolName}:raw`,
          title: `Tool Definition: ${toolName}`,
          text: rawTool,
          kind: "tool_config",
          toolName,
        });
      }
      continue;
    }

    if (!isRecord(tool)) continue;

    const toolName = extractToolName(tool, index + 1);
    const description = extractToolDescription(tool);
    const inputSchema = pickFirstSchema(
      tool.inputSchema,
      tool.input_schema,
      tool.inputSchemaJson,
      tool.input_schema_json,
      tool.parameters,
      tool.parameterSchema,
      tool.parameter_schema,
      tool.argsSchema,
      tool.args_schema,
      tool.schema,
      tool.jsonSchema,
      tool.json_schema,
      isRecord(tool.input) ? tool.input.schema : undefined,
      isRecord(tool.parameters) ? tool.parameters.schema : undefined,
      isRecord(tool.function) ? (tool.function as Record<string, unknown>).parameters : undefined
    );
    const outputSchema = pickFirstSchema(
      tool.outputSchema,
      tool.output_schema,
      tool.outputSchemaJson,
      tool.output_schema_json,
      tool.responseSchema,
      tool.response_schema,
      tool.returnSchema,
      tool.return_schema,
      tool.returns,
      tool.resultSchema,
      tool.result_schema,
      isRecord(tool.output) ? tool.output.schema : undefined,
      isRecord(tool.function) ? (tool.function as Record<string, unknown>).returns : undefined
    );

    if (description) {
      pushSource({
        id: `tool:${toolName}:description`,
        title: `Tool Description: ${toolName}`,
        text: description,
        kind: "tool_description",
        toolName,
      });
    }

    if (inputSchema !== null) {
      pushSource({
        id: `tool:${toolName}:input-schema`,
        title: `Tool Input Schema: ${toolName}`,
        text: toSourceText(inputSchema),
        kind: "tool_input_schema",
        toolName,
      });
    }

    if (outputSchema !== null) {
      pushSource({
        id: `tool:${toolName}:output-schema`,
        title: `Tool Output Schema: ${toolName}`,
        text: toSourceText(outputSchema),
        kind: "tool_output_schema",
        toolName,
      });
    }

    pushSource({
      id: `tool:${toolName}:config`,
      title: `Tool Configuration: ${toolName}`,
      text: toSourceText(tool),
      kind: "tool_config",
      toolName,
    });
  }

  return sources;
}

export function resolvePatchSource(
  patch: JudgePatch,
  sources: PatchSource[],
  dimension?: string
): PatchSourceResolution {
  const original = normalizeText(patch.original || "");
  const location = (patch.location || "").toLowerCase();
  const normalizedDimension = (dimension || "").toLowerCase();

  const fallbackSource =
    sources[0] ||
    ({
      id: "generic-fallback",
      title: "Patch Text",
      text: patch.original || "",
      kind: "generic",
    } satisfies PatchSource);

  let bestSource = fallbackSource;
  let bestScore = -1;
  let foundInBest = false;

  for (const source of sources) {
    let score = 0;
    let foundInSource = false;

    if (original) {
      const snippetMatch = findSnippetInPrompt(source.text, original);
      if (snippetMatch) {
        score += 120;
        foundInSource = true;
      }
    }

    if (location) {
      if (location.includes("system prompt") && source.kind === "system_prompt") score += 40;
      if (location.includes("description") && source.kind === "tool_description") score += 40;
      if (location.includes("schema") && (source.kind === "tool_input_schema" || source.kind === "tool_output_schema")) score += 40;
      if (location.includes("tool") && source.kind.startsWith("tool_")) score += 20;
      if (source.toolName && location.includes(source.toolName.toLowerCase())) score += 35;
    }

    if (normalizedDimension === "prompt_quality" && source.kind === "system_prompt") score += 20;
    if (normalizedDimension === "tool_description" && source.kind === "tool_description") score += 25;
    if (normalizedDimension === "tool_choice" && source.kind.startsWith("tool_")) score += 15;

    if (score > bestScore) {
      bestScore = score;
      bestSource = source;
      foundInBest = foundInSource;
    }
  }

  return {
    source: bestSource,
    foundInSource: foundInBest,
  };
}

function findSnippetInPrompt(
  prompt: string,
  snippet: string
): { start: number; end: number; matchedText: string } | null {
  const directCandidates = Array.from(
    new Set([snippet, snippet.trim(), snippet.replace(/\r\n/g, "\n")])
  ).filter((candidate) => candidate.length > 0);

  for (const candidate of directCandidates) {
    const index = prompt.indexOf(candidate);
    if (index !== -1) {
      return {
        start: index,
        end: index + candidate.length,
        matchedText: candidate,
      };
    }
  }

  const compactSnippet = snippet.trim();
  if (compactSnippet.length < 12) {
    return null;
  }

  const flexibleWhitespaceRegex = new RegExp(
    escapeRegExp(compactSnippet).replace(/\s+/g, "\\\\s+"),
    "m"
  );
  const regexMatch = flexibleWhitespaceRegex.exec(prompt);

  if (!regexMatch || regexMatch.index < 0) {
    return null;
  }

  return {
    start: regexMatch.index,
    end: regexMatch.index + regexMatch[0].length,
    matchedText: regexMatch[0],
  };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function humanizeCheckpointToken(token: string): string {
  return token
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractToolName(tool: Record<string, unknown>, index: number): string {
  const directName = asNonEmptyString(tool.name);
  if (directName) return directName;
  const title = asNonEmptyString(tool.title);
  if (title) return title;
  const id = asNonEmptyString(tool.id);
  if (id) return id;
  const key = asNonEmptyString(tool.key);
  if (key) return key;

  const fn = isRecord(tool.function) ? tool.function : null;
  const fnName = fn ? asNonEmptyString(fn.name) : null;
  if (fnName) return fnName;

  return `Tool ${index}`;
}

function extractToolDescription(tool: Record<string, unknown>): string | null {
  const directDescription = asNonEmptyString(tool.description);
  if (directDescription) return directDescription;
  const summary = asNonEmptyString(tool.summary);
  if (summary) return summary;
  const instructions = asNonEmptyString(tool.instructions);
  if (instructions) return instructions;

  const fn = isRecord(tool.function) ? tool.function : null;
  const fnDescription = fn ? asNonEmptyString(fn.description) : null;
  if (fnDescription) return fnDescription;

  const metadata = isRecord(tool.metadata) ? tool.metadata : null;
  if (!metadata) return null;
  return asNonEmptyString(metadata.description);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function pickFirstSchema(...values: unknown[]): unknown | null {
  for (const value of values) {
    const parsed = parseSchemaValue(value);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

function parseSchemaValue(value: unknown): unknown | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  return value;
}

function toSourceText(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
