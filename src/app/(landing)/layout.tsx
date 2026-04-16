import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

export const metadata: Metadata = {
  title: "OrangeBench — 你的 AI 工作台，统一无缝",
  description:
    "OrangeBench 把 AI 智能体、任务和团队协作整合进一个无缝流程。用一个 AI 原生工作台替代五个工具。",
  keywords: [
    "AI 工作台",
    "AI 智能体",
    "任务管理",
    "团队协作",
    "AI workspace",
    "AI agents",
  ],
  openGraph: {
    title: "OrangeBench — 你的 AI 工作台，统一无缝",
    description: "一个 AI 原生工作台，替代五个工具。",
    url: "https://orangebench.tech",
    siteName: "OrangeBench",
    locale: "zh_CN",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "OrangeBench — AI 工作台",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OrangeBench — 你的 AI 工作台，统一无缝",
    description: "一个 AI 原生工作台，替代五个工具。",
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
  description: "AI 原生工作台，为高效团队而生。",
};

export default async function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <main className="min-h-screen bg-[#0C0C0A] text-[#F5F5F4]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }}
        />
        {children}
      </main>
    </NextIntlClientProvider>
  );
}
