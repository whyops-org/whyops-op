import type { Metadata } from "next";
import { ContextRotDetector } from "@/components/tools/ContextRotDetector";
import { getToolDefinitionBySlug } from "@/constants/tools";
import { buildPublicPageMetadata } from "@/lib/seo";

const tool = getToolDefinitionBySlug("context-rot");

export const metadata: Metadata = buildPublicPageMetadata({
  path: tool?.href || "/tools/context-rot",
  title: tool?.seo.title || "Context Rot Detector for AI Agents",
  description:
    tool?.seo.description ||
    "Analyze multi-turn conversations and find where instructions start getting ignored as context grows.",
  keywords: tool?.seo.keywords || [],
});

export default function ContextRotPage() {
  return <ContextRotDetector />;
}
