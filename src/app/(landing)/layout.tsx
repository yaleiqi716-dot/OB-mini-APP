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
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "OrangeBench — AI Workspace for Teams",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OrangeBench — Your AI Workspace, Unified",
    description: "Replace 5 tools with one AI-native workspace.",
    images: ["/opengraph-image"],
  },
  robots: { index: true, follow: true },
};

const ORG_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "OrangeBench",
  url: "https://orangebench.tech",
  logo: "https://orangebench.tech/logo.png",
  description: "AI-native workspace for teams that ship fast.",
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#0C0C0A] text-[#F5F5F4]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }}
      />
      {children}
    </main>
  );
}
