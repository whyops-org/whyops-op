import type { Metadata } from "next";
import { TokenCalculator } from "@/components/tools/TokenCalculator";
import { getToolDefinitionBySlug } from "@/constants/tools";
import { buildPublicPageMetadata } from "@/lib/seo";

const tool = getToolDefinitionBySlug("token-calculator");

export const metadata: Metadata = buildPublicPageMetadata({
  path: tool?.href || "/tools/token-calculator",
  title: tool?.seo.title || "Token Burn Calculator for AI Models",
  description:
    tool?.seo.description ||
    "Look up live AI model pricing, cache pricing, and context window details, then estimate run and monthly spend.",
  keywords: tool?.seo.keywords || [],
});

export default function TokenCalculatorPage() {
  return <TokenCalculator />;
}
