/**
 * Heuristic format detection for common AI agent log structures.
 * Each entry: detect() returns true if input matches, convert() normalizes to NormalizedEvent[].
 * Zero LLM tokens spent.
 */

export interface NormalizedEvent {
  id: string;
  stepId: number;
  parentStepId?: number;
  eventType: 'user_message' | 'llm_response' | 'tool_call' | 'tool_call_request' | 'tool_call_response' | 'tool_result' | 'error';
  timestamp: string;
  content: unknown;
  metadata?: { tool?: string; model?: string; latency?: number; tool_call_id?: string; toolCallId?: string };
}

export interface NormalizedMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export type ParseMode = 'events' | 'messages';

function get(obj: unknown, key: string): unknown {
  if (typeof obj === 'object' && obj !== null && key in (obj as object)) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

function isArr(v: unknown): v is unknown[] { return Array.isArray(v); }
function isStr(v: unknown): v is string { return typeof v === 'string'; }
function isObj(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null && !Array.isArray(v); }

function contentToStr(content: unknown): string {
  if (content === null || content === undefined) return '';
  if (isStr(content)) return content;
  if (isArr(content)) {
    return content
      .map((c) => (isObj(c) && isStr(c.text) ? c.text : isStr(c) ? c : ''))
      .filter(Boolean)
      .join(' ');
  }
  return JSON.stringify(content);
}

function ts(i: number): string {
  return new Date(Date.now() + i * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// 1. OpenAI messages format  { messages: [{role, content, tool_calls?}] }
// ---------------------------------------------------------------------------
function detectOpenAI(obj: unknown): boolean {
  const msgs = get(obj, 'messages');
  if (!isArr(msgs) || msgs.length === 0) return false;
  const first = msgs[0];
  return isObj(first) && isStr(get(first, 'role')) && 'content' in (first as object);
}

function convertOpenAIToEvents(obj: unknown): NormalizedEvent[] {
  const msgs = isArr(get(obj, 'messages')) ? (get(obj, 'messages') as unknown[]) : (obj as unknown[]);
  const events: NormalizedEvent[] = [];
  let stepId = 1;
  let lastAssistantStepId: number | undefined;
  const toolNameById = new Map<string, string>();
  for (const m of msgs) {
    if (!isObj(m)) continue;
    const role = m.role as string;
    if (role === 'system') continue;
    if (role === 'assistant' && isArr(m.tool_calls) && m.tool_calls.length > 0) {
      const toolCalls = (m.tool_calls as unknown[])
        .filter(isObj)
        .map((tc) => {
          const fn = isObj(tc.function) ? tc.function : {};
          return {
            id: isStr(tc.id) ? tc.id : undefined,
            name: isStr(fn.name) ? fn.name : 'unknown_tool',
            arguments: isStr(fn.arguments) ? fn.arguments : JSON.stringify(fn.arguments ?? {}),
          };
        });
      events.push({
        id: `s${stepId}`,
        stepId,
        eventType: 'llm_response',
        timestamp: ts(stepId),
        content: {
          content: contentToStr(m.content),
          toolCalls,
          finishReason: 'tool_calls',
        },
      });
      lastAssistantStepId = stepId;
      stepId++;
      for (const tc of m.tool_calls as unknown[]) {
        if (!isObj(tc)) continue;
        const fn = isObj(tc.function) ? tc.function : {};
        let args: unknown = fn.arguments;
        try { args = JSON.parse(fn.arguments as string); } catch {}
        const toolCallId = isStr(tc.id) ? tc.id : `call_${stepId}`;
        const toolName = isStr(fn.name) ? fn.name : 'unknown_tool';
        toolNameById.set(toolCallId, toolName);
        events.push({
          id: `s${stepId}`,
          stepId,
          parentStepId: lastAssistantStepId,
          eventType: 'tool_call_request',
          timestamp: ts(stepId),
          content: { id: toolCallId, name: toolName, arguments: args },
          metadata: { tool: toolName, tool_call_id: toolCallId, toolCallId: toolCallId },
        });
        stepId++;
      }
    } else {
      if (role === 'user') {
        events.push({ id: `s${stepId}`, stepId, eventType: 'user_message', timestamp: ts(stepId), content: contentToStr(m.content) });
      } else if (role === 'tool') {
        const toolCallId = isStr(m.tool_call_id) ? m.tool_call_id : undefined;
        const toolName = toolCallId ? toolNameById.get(toolCallId) : undefined;
        events.push({
          id: `s${stepId}`,
          stepId,
          parentStepId: lastAssistantStepId,
          eventType: 'tool_call_response',
          timestamp: ts(stepId),
          content: contentToStr(m.content),
          metadata: {
            ...(toolName ? { tool: toolName } : {}),
            ...(toolCallId ? { tool_call_id: toolCallId, toolCallId: toolCallId } : {}),
          },
        });
      } else {
        events.push({
          id: `s${stepId}`,
          stepId,
          eventType: 'llm_response',
          timestamp: ts(stepId),
          content: { content: contentToStr(m.content) },
        });
        lastAssistantStepId = stepId;
      }
      stepId++;
    }
  }
  return events;
}

function convertOpenAIToMessages(obj: unknown): NormalizedMessage[] {
  const msgs = isArr(get(obj, 'messages')) ? (get(obj, 'messages') as unknown[]) : (obj as unknown[]);
  return msgs
    .filter(isObj)
    .map((m) => ({ role: m.role as NormalizedMessage['role'], content: contentToStr(m.content) }));
}

// ---------------------------------------------------------------------------
// 2. Flat OpenAI array [{role, content}]
// ---------------------------------------------------------------------------
function detectFlatOpenAI(obj: unknown): boolean {
  if (!isArr(obj) || obj.length === 0) return false;
  const first = obj[0];
  return isObj(first) && isStr(get(first, 'role')) && 'content' in (first as object);
}

// ---------------------------------------------------------------------------
// 3. Anthropic messages  { role, content: [{type:'text', text}] }  or  { messages: [{role, content:[]}] }
// ---------------------------------------------------------------------------
function detectAnthropic(obj: unknown): boolean {
  // Top-level single message
  if (isObj(obj) && isStr(get(obj, 'role')) && isArr(get(obj, 'content'))) {
    const first = (get(obj, 'content') as unknown[])[0];
    return isObj(first) && get(first, 'type') === 'text';
  }
  // Wrapped messages array with Anthropic-style content
  const msgs = get(obj, 'messages');
  if (isArr(msgs) && msgs.length > 0) {
    const first = msgs[0];
    if (isObj(first) && isArr(get(first, 'content'))) {
      const fc = (get(first, 'content') as unknown[])[0];
      return isObj(fc) && isStr(get(fc, 'type'));
    }
  }
  return false;
}

function convertAnthropicToMessages(obj: unknown): NormalizedMessage[] {
  const rawMsgs = isArr(get(obj, 'messages'))
    ? (get(obj, 'messages') as unknown[])
    : isArr(obj) ? obj : [obj];
  return rawMsgs.filter(isObj).map((m) => ({
    role: m.role as NormalizedMessage['role'],
    content: contentToStr(m.content),
  }));
}

function convertAnthropicToEvents(obj: unknown): NormalizedEvent[] {
  const msgs = convertAnthropicToMessages(obj);
  return msgs.map((m, i) => ({
    id: `s${i + 1}`, stepId: i + 1,
    eventType: m.role === 'user' ? 'user_message' : 'llm_response',
    timestamp: ts(i + 1), content: m.role === 'user' ? m.content : { content: m.content },
  }));
}

// ---------------------------------------------------------------------------
// 4. WhyOps native  { events: [{eventType, content, metadata}] }
// ---------------------------------------------------------------------------
const WHYOPS_EVENT_TYPES = new Set(['user_message', 'llm_response', 'tool_call', 'tool_result', 'error', 'llm_thinking', 'tool_call_request', 'embedding_request']);

function detectWhyOpsNative(obj: unknown): boolean {
  const evts = get(obj, 'events');
  if (!isArr(evts) || evts.length === 0) return false;
  const first = evts[0];
  return isObj(first) && isStr(get(first, 'eventType')) && WHYOPS_EVENT_TYPES.has(get(first, 'eventType') as string);
}

function convertWhyOpsToEvents(obj: unknown): NormalizedEvent[] {
  const evts = get(obj, 'events') as unknown[];
  return evts.filter(isObj).map((e, i) => ({
    id: (e.id as string) ?? `s${i + 1}`,
    stepId: (e.stepId as number) ?? i + 1,
    eventType: e.eventType as NormalizedEvent['eventType'],
    timestamp: (e.timestamp as string) ?? ts(i),
    content: e.content,
    metadata: e.metadata as NormalizedEvent['metadata'],
  }));
}

// ---------------------------------------------------------------------------
// 5. Langfuse  { observations: [{type, startTime, input, output}] }
// ---------------------------------------------------------------------------
const LANGFUSE_OBS_TYPES = new Set(['generation', 'span', 'event']);

function detectLangfuse(obj: unknown): boolean {
  const obs = get(obj, 'observations');
  if (!isArr(obs) || obs.length === 0) return false;
  const first = obs[0];
  return isObj(first) && LANGFUSE_OBS_TYPES.has(get(first, 'type') as string);
}

function convertLangfuseToEvents(obj: unknown): NormalizedEvent[] {
  const obs = get(obj, 'observations') as unknown[];
  return obs.filter(isObj).map((o, i) => {
    const type = o.type as string;
    const eventType: NormalizedEvent['eventType'] =
      type === 'generation' ? 'llm_response' : type === 'event' ? 'user_message' : 'tool_call';
    const latency = isStr(o.startTime) && isStr(o.endTime)
      ? new Date(o.endTime as string).getTime() - new Date(o.startTime as string).getTime()
      : undefined;
    return {
      id: (o.id as string) ?? `s${i + 1}`, stepId: i + 1, eventType,
      timestamp: (o.startTime as string) ?? ts(i),
      content: o.output ?? o.input,
      metadata: { model: o.model as string, latency },
    };
  });
}

// ---------------------------------------------------------------------------
// 6. LangChain runs  { runs: [{run_type, inputs, outputs}] }  or  { generations: [[{text}]] }
// ---------------------------------------------------------------------------
function detectLangChain(obj: unknown): boolean {
  const runs = get(obj, 'runs');
  if (isArr(runs) && runs.length > 0 && isObj(runs[0]) && 'run_type' in (runs[0] as object)) return true;
  const gens = get(obj, 'generations');
  return isArr(gens) && gens.length > 0 && isArr(gens[0]);
}

function convertLangChainToEvents(obj: unknown): NormalizedEvent[] {
  if (isArr(get(obj, 'runs'))) {
    return (get(obj, 'runs') as unknown[]).filter(isObj).map((r, i) => {
      const run = r as Record<string, unknown>;
      return {
        id: (run.id as string) ?? `s${i + 1}`, stepId: i + 1,
        eventType: run.run_type === 'llm' ? 'llm_response' : run.run_type === 'tool' ? 'tool_call_request' : 'user_message',
        timestamp: (run.start_time as string) ?? ts(i),
        content: run.run_type === 'llm'
          ? { content: contentToStr(run.outputs ?? run.output ?? '') }
          : run.run_type === 'tool'
            ? { name: (run.name as string) ?? ((run.serialized as Record<string, unknown>)?.name as string) ?? 'tool', arguments: run.inputs ?? {} }
            : contentToStr(run.inputs ?? run.input ?? ''),
        metadata: { model: (run.serialized as Record<string, unknown>)?.name as string, tool: run.run_type === 'tool' ? ((run.name as string) ?? ((run.serialized as Record<string, unknown>)?.name as string) ?? 'tool') : undefined },
      };
    });
  }
  // generations[][{text}]
  return (get(obj, 'generations') as unknown[][]).flat().map((g, i) => ({
    id: `s${i + 1}`, stepId: i + 1, eventType: 'llm_response',
    timestamp: ts(i), content: { content: isObj(g) ? (g as Record<string, unknown>).text : g },
  }));
}

// ---------------------------------------------------------------------------
// 7. OpenTelemetry spans  { spans: [{name, startTimeUnixNano, attributes}] }
// ---------------------------------------------------------------------------
function detectOTel(obj: unknown): boolean {
  const spans = get(obj, 'spans') ?? get(obj, 'resourceSpans');
  if (!isArr(spans) || spans.length === 0) return false;
  const first = spans[0];
  return isObj(first) && ('startTimeUnixNano' in (first as object) || 'name' in (first as object));
}

function convertOTelToEvents(obj: unknown): NormalizedEvent[] {
  const spans = (get(obj, 'spans') ?? get(obj, 'resourceSpans')) as unknown[];
  return spans.filter(isObj).map((s, i) => {
    const nsec = BigInt(s.startTimeUnixNano as string ?? '0');
    const ts_ = new Date(Number(nsec / 1_000_000n)).toISOString();
    return {
      id: (s.spanId as string) ?? `s${i + 1}`, stepId: i + 1, eventType: 'llm_response',
      timestamp: ts_, content: s.attributes,
      metadata: { tool: s.name as string },
    };
  });
}

// ---------------------------------------------------------------------------
// 8. Generic steps  { steps: [{type, input, output}] }  or  array of steps
// ---------------------------------------------------------------------------
function detectGenericSteps(obj: unknown): boolean {
  const steps = get(obj, 'steps') ?? (isArr(obj) ? obj : null);
  if (!isArr(steps) || steps.length === 0) return false;
  const first = steps[0];
  return isObj(first) && ('input' in (first as object) || 'output' in (first as object) || 'action' in (first as object));
}

function convertGenericStepsToEvents(obj: unknown): NormalizedEvent[] {
  const steps = (isArr(get(obj, 'steps')) ? get(obj, 'steps') : obj) as unknown[];
  return steps.filter(isObj).map((s, i) => {
    const type = (s.type ?? s.action_type ?? 'step') as string;
    const isAI = ['llm', 'ai', 'model', 'agent', 'generation'].some((k) => type.toLowerCase().includes(k));
    const isTool = ['tool', 'function', 'action', 'observation'].some((k) => type.toLowerCase().includes(k));
    return {
      id: `s${i + 1}`, stepId: i + 1,
      eventType: isAI ? 'llm_response' : isTool ? 'tool_call_request' : 'user_message',
      timestamp: (s.timestamp ?? s.created_at ?? ts(i)) as string,
      content: isAI
        ? { content: contentToStr(s.output ?? s.observation ?? s.input) }
        : isTool
          ? { name: (s.action as string) ?? (s.type as string) ?? 'tool', arguments: s.input ?? s.arguments ?? {} }
          : contentToStr(s.input ?? s.message ?? s.text ?? ''),
      metadata: { tool: isTool ? ((s.action as string) ?? (s.type as string) ?? 'tool') : undefined },
    };
  });
}

// ---------------------------------------------------------------------------
// 9. Flat turns array  [{from/author/speaker, text/message}]
// ---------------------------------------------------------------------------
function detectFlatTurns(obj: unknown): boolean {
  if (!isArr(obj) || obj.length === 0) return false;
  const first = obj[0];
  if (!isObj(first)) return false;
  return Boolean(get(first, 'from') ?? get(first, 'author') ?? get(first, 'speaker'));
}

function convertFlatTurnsToMessages(obj: unknown): NormalizedMessage[] {
  return (obj as unknown[]).filter(isObj).map((m) => {
    const speaker = ((get(m, 'from') ?? get(m, 'author') ?? get(m, 'speaker') ?? 'user') as string).toLowerCase();
    const role: NormalizedMessage['role'] = speaker.includes('assist') || speaker.includes('ai') || speaker.includes('bot') ? 'assistant' : speaker === 'system' ? 'system' : 'user';
    return { role, content: contentToStr(get(m, 'text') ?? get(m, 'message') ?? get(m, 'content') ?? '') };
  });
}

// ---------------------------------------------------------------------------
// 10. Generic history/turns wrapper  { history: [{role, content}] }
// ---------------------------------------------------------------------------
function detectGenericHistory(obj: unknown): boolean {
  const hist = get(obj, 'history') ?? get(obj, 'turns') ?? get(obj, 'conversation');
  if (!isArr(hist) || hist.length === 0) return false;
  const first = hist[0];
  return isObj(first) && ('role' in (first as object) || 'content' in (first as object));
}

function convertGenericHistoryToMessages(obj: unknown): NormalizedMessage[] {
  const hist = (get(obj, 'history') ?? get(obj, 'turns') ?? get(obj, 'conversation')) as unknown[];
  return hist.filter(isObj).map((m) => ({
    role: ((m.role ?? m.speaker ?? 'user') as NormalizedMessage['role']),
    content: contentToStr(m.content ?? m.text ?? m.message ?? ''),
  }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export interface HeuristicResult {
  format: string;
  events?: NormalizedEvent[];
  messages?: NormalizedMessage[];
}

/**
 * Tries each heuristic in priority order.
 * Returns null if no format is recognized.
 */
export function detectAndConvert(obj: unknown, mode: ParseMode): HeuristicResult | null {
  // WhyOps native first (most specific)
  if (detectWhyOpsNative(obj)) {
    const events = convertWhyOpsToEvents(obj);
    return { format: 'whyops-native', events, messages: eventsToMessages(events) };
  }
  // OpenAI (and flat variant)
  if (detectOpenAI(obj) || detectFlatOpenAI(obj)) {
    const norm = detectOpenAI(obj) ? obj : { messages: obj };
    return { format: 'openai-messages', events: convertOpenAIToEvents(norm), messages: convertOpenAIToMessages(norm) };
  }
  // Anthropic
  if (detectAnthropic(obj)) {
    return { format: 'anthropic-messages', events: convertAnthropicToEvents(obj), messages: convertAnthropicToMessages(obj) };
  }
  // Langfuse
  if (detectLangfuse(obj)) {
    return { format: 'langfuse', events: convertLangfuseToEvents(obj) };
  }
  // LangChain
  if (detectLangChain(obj)) {
    return { format: 'langchain', events: convertLangChainToEvents(obj) };
  }
  // OpenTelemetry
  if (detectOTel(obj)) {
    return { format: 'opentelemetry', events: convertOTelToEvents(obj) };
  }
  // Generic history wrapper
  if (detectGenericHistory(obj)) {
    const msgs = convertGenericHistoryToMessages(obj);
    return { format: 'generic-history', messages: msgs, events: messagesToEvents(msgs) };
  }
  // Generic steps
  if (detectGenericSteps(obj)) {
    return { format: 'generic-steps', events: convertGenericStepsToEvents(obj) };
  }
  // Flat turns
  if (detectFlatTurns(obj)) {
    const msgs = convertFlatTurnsToMessages(obj);
    return { format: 'flat-turns', messages: msgs, events: messagesToEvents(msgs) };
  }
  return null;
}

function eventsToMessages(events: NormalizedEvent[]): NormalizedMessage[] {
  return events
    .filter((e) => ['user_message', 'llm_response'].includes(e.eventType))
    .map((e) => ({
      role: e.eventType === 'user_message' ? 'user' : 'assistant',
      content: contentToStr(e.content),
    }));
}

function messagesToEvents(msgs: NormalizedMessage[]): NormalizedEvent[] {
  return msgs.map((m, i) => {
    const eventType = m.role === 'user' ? 'user_message' : m.role === 'system' ? 'user_message' : 'llm_response';
    return {
      id: `s${i + 1}`,
      stepId: i + 1,
      eventType,
      timestamp: ts(i),
      content: eventType === 'user_message' ? m.content : { content: m.content },
    };
  });
}
