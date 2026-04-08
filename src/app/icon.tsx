import { ImageResponse } from 'next/og';

// Next.js App Router convention: generates /icon (the favicon).
// Runs on the Edge, generates a PNG at request time.
// DESIGN.md v1.2 tokens: bg #0B0B0C, orange #FF5A1F.

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0B0B0C',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: '#FF5A1F',
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '-0.04em',
          }}
        >
          O
        </div>
      </div>
    ),
    { ...size },
  );
}
