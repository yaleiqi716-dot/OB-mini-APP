import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ORANGEBENCH',
  description: '企业智能工作系统',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
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
      </body>
    </html>
  );
}
