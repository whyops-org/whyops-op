import { AuthGate } from "@/components/auth/auth-gate";
import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const displayFont = Sora({
  variable: "--font-display",
  subsets: ["latin"],
});

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://app.whyops.com";
const APP_NAME = "WhyOps App";
const APP_DESCRIPTION =
  "Monitor, debug, and improve AI agents in production with trace timelines, decision analysis, and operational controls.";
const DEFAULT_TITLE = `${APP_NAME} - Agent Observability Workspace`;
const OG_IMAGE = "/assets/whyops-og.webp";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  authors: [{ name: "WhyOps" }],
  creator: "WhyOps",
  publisher: "WhyOps",
  keywords: [
    "AI agent observability",
    "agent debugging",
    "trace analytics",
    "LLM operations",
    "agent monitoring",
    "production AI",
  ],
  category: "technology",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: APP_URL,
    title: DEFAULT_TITLE,
    description: APP_DESCRIPTION,
    siteName: APP_NAME,
    locale: "en_US",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${APP_NAME} - Agent Observability Workspace`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: APP_DESCRIPTION,
    images: [OG_IMAGE],
  },
  icons: {
    icon: "/assets/WhyOpsLogo.svg",
    shortcut: "/assets/WhyOpsLogo.svg",
    apple: "/assets/WhyOpsLogo.svg",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${bodyFont.variable} ${displayFont.variable} antialiased`}>
        <AuthGate>{children}</AuthGate>
        <Toaster />
      </body>
    </html>
  );
}
