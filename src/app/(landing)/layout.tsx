import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OrangeBench — Your AI Workspace, Unified",
  description:
    "OrangeBench brings agents, tasks, and teams into one seamless workflow. Built for teams that ship fast.",
  keywords: [
    "AI workspace",
    "AI agents",
    "task management",
    "team collaboration",
  ],
  openGraph: {
    title: "OrangeBench — Your AI Workspace, Unified",
    description: "Replace 5 tools with one AI-native workspace.",
    url: "https://orangebench.tech",
    siteName: "OrangeBench",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OrangeBench — Your AI Workspace, Unified",
    description: "Replace 5 tools with one AI-native workspace.",
  },
  robots: { index: true, follow: true },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#0C0C0A] text-[#F5F5F4]">
      {children}
    </main>
  );
}
