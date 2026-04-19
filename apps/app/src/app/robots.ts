import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/tools", "/tools/"],
        disallow: [
          "/agents",
          "/settings",
          "/traces",
          "/onboarding",
          "/api",
        ],
      },
    ],
    host: siteUrl,
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
