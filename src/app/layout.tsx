import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://orangebench.tech'),
  title: {
    default: 'OrangeBench · 让 AI 帮你完成任务,你来审核交付',
    template: '%s · OrangeBench',
  },
  description:
    '给小团队的 AI 工作平台。把写邮件、整理会议纪要、生成方案草稿交给 AI,团队只负责审核和交付。OrangeBench 让 AI 真正上班。',
  applicationName: 'OrangeBench',
  authors: [{ name: 'OrangeBench' }],
  creator: 'OrangeBench',
  publisher: 'OrangeBench',
  keywords: [
    'OrangeBench',
    'AI workspace',
    'AI 工作平台',
    'AI 助手',
    'AI agent',
    '团队协作',
    'AI 自动化',
    '企业 AI',
    'AI 代理',
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: 'https://orangebench.tech',
    siteName: 'OrangeBench',
    title: 'OrangeBench · 让 AI 帮你完成任务',
    description:
      '给小团队的 AI 工作平台。写邮件、整理会议、生成方案 —— AI 做完,你来审核。',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OrangeBench · 让 AI 帮你完成任务',
    description:
      '给小团队的 AI 工作平台。写邮件、整理会议、生成方案 —— AI 做完,你来审核。',
    creator: '@orangebench',
  },
  alternates: {
    canonical: '/',
  },
  formatDetection: {
    email: false,
    telephone: false,
    address: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/*
          OrangeBench Design System v1.2 fonts — DESIGN.md is source of truth.
          - Cabinet Grotesk (display / wordmark) from Fontshare
          - Geist + Geist Mono (body + data) from Google Fonts
          - Noto Sans SC (CJK fallback; production ideally self-hosts HarmonyOS Sans SC)
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@700,800&f[]=general-sans@500,600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
