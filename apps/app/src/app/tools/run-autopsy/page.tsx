import type { Metadata } from "next";
import { RunAutopsy } from "@/components/tools/RunAutopsy";
import { getToolDefinitionBySlug } from "@/constants/tools";
import { buildPublicPageMetadata } from "@/lib/seo";

const tool = getToolDefinitionBySlug("run-autopsy");

export const metadata: Metadata = buildPublicPageMetadata({
  path: tool?.href || "/tools/run-autopsy",
  title: tool?.seo.title || "Run Autopsy for AI Agents",
  description:
    tool?.seo.description ||
    "Paste AI run JSON and turn it into a readable trace with step order, tool calls, and failure context.",
  keywords: tool?.seo.keywords || [],
});

export default function RunAutopsyPage() {
  return <RunAutopsy />;
}
