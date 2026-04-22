import type { LLMEvent } from '@whyops/shared/models';
import type { ReplayEvent, ReplayComparison } from '@whyops/shared/models';
import type { ReplayExecutionResult } from './trace-replay-executor';

function countErrors(events: Array<{ eventType: string }>): number {
  return events.filter((e) => e.eventType === 'error').length;
}

function countToolCalls(events: Array<{ eventType: string }>): number {
  return events.filter(
    (e) => e.eventType === 'tool_call_request' || e.eventType === 'tool_call_response'
  ).length;
}

function hasRetryLoop(events: LLMEvent[]): boolean {
  const sigs: string[] = [];
  for (const e of events) {
    if (e.eventType !== 'llm_response') continue;
    const tcs = (e.content as any)?.toolCalls ?? (e.content as any)?.tool_calls ?? [];
    if (!Array.isArray(tcs) || tcs.length === 0) continue;
    const sig = tcs
      .map((tc: any) => `${tc?.function?.name ?? tc?.name}::${tc?.function?.arguments ?? ''}`)
      .sort()
      .join('|');
    if (sigs.includes(sig)) return true;
    sigs.push(sig);
  }
  return false;
}

function extractFinalAnswer(events: Array<{ eventType: string; content: any }>): string {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.eventType !== 'llm_response') continue;
    const c = e.content;
    const text =
      (typeof c?.content === 'string' ? c.content : null) ??
      (typeof c?.text === 'string' ? c.text : null) ??
      '';
    if (text.trim()) return text.trim();
  }
  return '';
}

export function scoreReplay(
  originalEvents: LLMEvent[],
  result: ReplayExecutionResult
): ReplayComparison {
  const replayEvents: ReplayEvent[] = result.events;

  const origErrors = countErrors(originalEvents);
  const replayErrors = countErrors(replayEvents);
  const origTools = countToolCalls(originalEvents);
  const replayTools = countToolCalls(replayEvents);

  const originalHadLoop = hasRetryLoop(originalEvents);
  const replayHadLoop = hasRetryLoop(
    replayEvents.map((e) => ({ ...e, id: '', spanId: undefined, parentStepId: undefined, userId: '', timestamp: new Date(), createdAt: new Date() }) as unknown as LLMEvent)
  );
  const loopResolved = originalHadLoop && !replayHadLoop;

  const origFinal = extractFinalAnswer(originalEvents);
  const replayFinal = extractFinalAnswer(replayEvents);
  const finalAnswerChanged = replayFinal.trim() !== origFinal.trim() && replayFinal.trim().length > 0;

  // Score: weighted composite 0–1
  let score = 0.5;

  // Error reduction (up to +0.3)
  if (origErrors > 0) {
    const reduction = Math.max(0, origErrors - replayErrors) / origErrors;
    score += reduction * 0.3;
  } else if (replayErrors === 0) {
    score += 0.1;
  }

  // Loop resolution (+0.2)
  if (loopResolved) score += 0.2;

  // Step count efficiency (+/- 0.1)
  const stepDelta = originalEvents.length - replayEvents.length;
  if (stepDelta > 0) score += 0.1; // fewer steps = more efficient
  else if (stepDelta < -5) score -= 0.1; // significantly more steps = penalize

  // Stop reason affects score
  if (result.stopReason === 'error') score -= 0.2;
  if (result.stopReason === 'unresolvable_tool') score -= 0.1;
  if (result.stopReason === 'max_steps') score -= 0.1;

  score = Math.max(0, Math.min(1, score));

  const parts: string[] = [];
  if (loopResolved) parts.push('retry loop eliminated');
  if (origErrors > 0 && replayErrors < origErrors) parts.push(`errors reduced ${origErrors}→${replayErrors}`);
  if (origErrors === 0 && replayErrors === 0) parts.push('no errors in either run');
  if (finalAnswerChanged) parts.push('final answer changed');
  if (result.stopReason === 'unresolvable_tool') parts.push('stopped: missing tool output');
  if (result.stopReason === 'max_steps') parts.push('stopped: max steps reached');

  const summary =
    parts.length > 0
      ? parts.join('; ') + `. Score: ${(score * 100).toFixed(0)}%.`
      : `Replay completed. Score: ${(score * 100).toFixed(0)}%.`;

  return {
    originalStepCount: originalEvents.length,
    replayStepCount: replayEvents.length,
    originalErrorCount: origErrors,
    replayErrorCount: replayErrors,
    originalToolCallCount: origTools,
    replayToolCallCount: replayTools,
    loopResolved,
    finalAnswerChanged,
    score,
    summary,
  };
}
