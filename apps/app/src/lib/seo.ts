import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://app.whyops.com";
const BRAND_NAME = "WhyOps";
const OG_IMAGE = "/assets/whyops-og.webp";

interface SeoInput {
  path: string;
  title: string;
  description: string;
  keywords: string[];
}

function buildAbsoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString();
}

export function getSiteUrl() {
  return SITE_URL;
}

export function buildPublicPageMetadata({
  path,
  title,
  description,
  keywords,
}: SeoInput): Metadata {
  const absoluteTitle = `${title} | ${BRAND_NAME}`;
  const absoluteUrl = buildAbsoluteUrl(path);

  return {
    title,
    description,
    keywords,
    category: "developer tools",
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: "website",
      url: absoluteUrl,
      title: absoluteTitle,
      description,
      siteName: BRAND_NAME,
      locale: "en_US",
      images: [
        {
          url: OG_IMAGE,
          width: 1200,
          height: 630,
          alt: absoluteTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: absoluteTitle,
      description,
      images: [OG_IMAGE],
    },
  };
}
