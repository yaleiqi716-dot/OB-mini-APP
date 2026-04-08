import { ImageResponse } from 'next/og';

// Next.js App Router convention: generates /opengraph-image at build/request time.
// Used for Twitter/Facebook/LinkedIn/WeChat link preview cards.
// 1200x630 per OG spec. DESIGN.md v1.2 tokens.
//
// Kept English-only to avoid CJK font fetching on the Edge runtime.
// The wordmark is the brand; tagline is short + universally legible.

export const runtime = 'edge';
export const alt = 'OrangeBench — AI Workspace for Teams';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0B0B0C',
          display: 'flex',
          flexDirection: 'column',
          padding: '72px 80px',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {/* Kicker */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '0.28em',
            color: '#8A8A90',
            textTransform: 'uppercase',
          }}
        >
          <span style={{ width: 56, height: 2, background: '#FF5A1F', display: 'flex' }} />
          <span>AI Workspace</span>
        </div>

        {/* Wordmark — single line, sized to fit 1040px content width */}
        <div
          style={{
            display: 'flex',
            marginTop: 44,
            fontSize: 124,
            fontWeight: 900,
            letterSpacing: '-0.035em',
            lineHeight: 1,
          }}
        >
          <span style={{ color: '#FF5A1F' }}>ORANGE</span>
          <span style={{ color: '#F5F5F0' }}>BENCH</span>
        </div>

        {/* Tagline — single line */}
        <div
          style={{
            marginTop: 36,
            fontSize: 40,
            color: '#F5F5F0',
            lineHeight: 1.2,
            fontWeight: 500,
            display: 'flex',
          }}
        >
          The AI does the work. You just review.
        </div>

        {/* Sub-tagline, lighter */}
        <div
          style={{
            marginTop: 14,
            fontSize: 26,
            color: '#8A8A90',
            lineHeight: 1.3,
            fontWeight: 400,
            display: 'flex',
          }}
        >
          Email drafts. Meeting notes. Proposals. Shipped by AI, approved by you.
        </div>

        {/* Footer bar */}
        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 20,
            color: '#8A8A90',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          <span>orangebench.tech</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF5A1F' }} />
            AI Workspace for Teams
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
