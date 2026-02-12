import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";
import { AuthGate } from "@/components/auth/auth-gate";

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const displayFont = Sora({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WhyOps Onboarding",
  description: "WhyOps onboarding flow UI prototype.",
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
      </body>
    </html>
  );
}
