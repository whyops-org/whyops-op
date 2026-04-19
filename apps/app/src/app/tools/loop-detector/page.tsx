import type { Metadata } from "next";
import { LoopDetector } from "@/components/tools/LoopDetector";
import { getToolDefinitionBySlug } from "@/constants/tools";
import { buildPublicPageMetadata } from "@/lib/seo";

const tool = getToolDefinitionBySlug("loop-detector");

export const metadata: Metadata = buildPublicPageMetadata({
  path: tool?.href || "/tools/loop-detector",
  title: tool?.seo.title || "Loop Detector for AI Agent Runs",
  description:
    tool?.seo.description ||
    "Find repeated tool calls, recurring failures, and retry loops across AI agent runs.",
  keywords: tool?.seo.keywords || [],
});

export default function LoopDetectorPage() {
  return <LoopDetector />;
}
