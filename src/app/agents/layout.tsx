import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agents | WhyOps",
  description: "WhyOps Agents - Monitor your AI agents",
};

export default function AgentsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="dark">{children}</div>;
}
