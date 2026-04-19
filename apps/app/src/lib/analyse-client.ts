import axios from "axios";

const ANALYSE_BASE_URL = process.env.NEXT_PUBLIC_ANALYSE_BASE_URL;

function getAnalyseBaseUrl(): string {
  if (!ANALYSE_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_ANALYSE_BASE_URL");
  }
  return ANALYSE_BASE_URL.replace(/\/$/, "");
}

export const analyseClient = axios.create({
  baseURL: getAnalyseBaseUrl(),
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export interface EventPayload {
  eventType:
    | "user_message"
    | "llm_response"
    | "tool_call"
    | "tool_call_request"
    | "tool_call_response"
    | "tool_result"
    | "error";
  traceId: string;
  userId: string;
  projectId: string;
  environmentId: string;
  providerId?: string;
  content?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export async function sendEvent(event: EventPayload): Promise<void> {
  await analyseClient.post("/api/events", event);
}
