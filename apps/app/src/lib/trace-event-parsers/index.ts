export * from "./types";
export * from "./openai-types";
export { openAiTraceEventParser } from "./openai";
export { anthropicTraceEventParser } from "./anthropic";

import { openAiTraceEventParser } from "./openai";
import { anthropicTraceEventParser } from "./anthropic";

export const defaultTraceEventParsers = [openAiTraceEventParser, anthropicTraceEventParser];
