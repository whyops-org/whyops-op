import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | WhyOps",
  description: "WhyOps Dashboard - Monitor your AI agents",
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="dark">{children}</div>;
}
