import type { TraceEvent } from "@/stores/traceDetailStore";

export interface TraceEventParser {
  id: string;
  canParse: (event: TraceEvent) => boolean;
  parse: (event: TraceEvent) => TraceEvent;
}

export type TraceEventParserInput = TraceEventParser | TraceEventParser[];

export function normalizeParsers(input?: TraceEventParserInput): TraceEventParser[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

export function parseTraceEvent(event: TraceEvent, parsers: TraceEventParser[]): TraceEvent {
  if (parsers.length === 0) return event;
  return parsers.reduce((current, parser) => {
    if (!parser.canParse(current)) {
      return current;
    }
    return parser.parse(current);
  }, event);
}

export function parseTraceEvents(events: TraceEvent[], input?: TraceEventParserInput): TraceEvent[] {
  const parsers = normalizeParsers(input);
  if (parsers.length === 0) return events;
  return events.map((event) => parseTraceEvent(event, parsers));
}
