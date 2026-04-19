import type { MetadataRoute } from "next";
import {
  TOOL_DEFINITIONS,
  TOOLS_INDEX_DEFINITION,
} from "@/constants/tools";
import { getSiteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date();

  return [
    {
      url: new URL(TOOLS_INDEX_DEFINITION.href, siteUrl).toString(),
      lastModified,
      changeFrequency: TOOLS_INDEX_DEFINITION.changeFrequency,
      priority: TOOLS_INDEX_DEFINITION.priority,
    },
    ...TOOL_DEFINITIONS.map((tool) => ({
      url: new URL(tool.href, siteUrl).toString(),
      lastModified,
      changeFrequency: tool.seo.changeFrequency,
      priority: tool.seo.priority,
    })),
  ];
}
