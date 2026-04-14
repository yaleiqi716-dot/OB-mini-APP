# CLAUDE.md — OrangeBench project rules

## Design System

**Always read `DESIGN.md` before making any visual or UI decisions.**

All font choices, colors, spacing, border-radius, motion, and aesthetic direction are defined there. Do not deviate without explicit user approval. Do not introduce new hex values, new fonts, or new spacing units. If a design token you need is missing, propose adding it to `DESIGN.md` first, then use it.

When reviewing UI code:
- Flag any hex value that is not in `DESIGN.md` color tables.
- Flag any `font-family` that is not Cabinet Grotesk / Geist / Geist Mono / HarmonyOS Sans SC / Noto Sans SC.
- Flag deprecated values: `#FF3D00`, `#FF6B00`, Tailwind `orange-500`, `orange-600`, `Inter`, `Roboto`, raw `#000`, raw `#FFF`.
- Flag uniform bubbly border-radius (everything `rounded-2xl`) — use the radius scale.

When implementing new UI:
- Orange `#FF5A1F` is a design primitive, not an accent. Use it boldly in display typography, not only on buttons.
- One primary CTA per page. Secondary actions use surface-high background + border.
- Warm off-white text `#F5F5F0` on warm near-black `#0B0B0C`. Not `#FFF` on `#000`.
- Editorial asymmetry for marketing / login / invite. Strict 12-col grid for app interior.

## Dev notes

- Next.js 14.2 App Router, Tailwind, Prisma (SQLite dev / Postgres prod).
- Env: requires `.env.local` with `DATABASE_URL`, `OPENROUTER_API_KEY`, `NEXT_PUBLIC_APP_URL`, Google OAuth creds, etc. See `README.md`.
- Auth: new code must use `getUserIdFromRequest(req)` from `src/lib/auth.ts` — never read `ob-user-id` cookie directly.
- Rate limiting: unauthenticated endpoints must use `src/lib/rate-limit.ts`.
