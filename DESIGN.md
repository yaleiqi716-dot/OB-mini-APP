# Design System — OrangeBench

> **Source of truth for all visual and UI decisions.** Before writing UI code, reference this file. Before proposing a visual change, update this file. If the code disagrees with this file, the code is wrong.

**Version:** 1.2 · **Created:** 2026-04-08 · **Method:** `/design-consultation` with competitive research

---

## Product Context

- **What this is:** ORANGEBENCH — an enterprise AI agent platform. Users type a task in natural language; the system understands, generates a workflow, and executes it live.
- **Who it's for:** Chinese-market enterprise knowledge workers — marketing, sales ops, finance, product teams who need to get structured work done without writing prompts or learning a workflow builder.
- **Space:** AI agent / workflow automation. Adjacent to Coze, Dify, Manus, Lindy, Notion AI.
- **Project type:** Back-end-heavy web app with marketing surface. Both individual and team/workspace tiers. Credits + subscription billing (WeChat Pay).
- **Primary locale:** 简体中文 (zh-CN). Design system must handle CJK typography gracefully.
- **Official tagline:** 企业智能工作系统 (Enterprise Intelligent Work System)

---

## Aesthetic Direction

**Direction:** Editorial Confident — between Linear (dark, dense, serious) and Manus (warm, crafted, opinionated), with a pop-culture poster energy neither owns.

**Mood:** The product should feel like a tool made by someone with taste. Warm, not sterile. Dense where information needs to be dense, breathing where it doesn't. Orange as a design primitive, not an accent — the brand color should feel like a graphic element, not a button color.

**Mental reference:** NYT editorial × Uniqlo wordmark confidence × ChatGPT's restraint in the input box.

**Decoration level:** Minimal + typographic. Typography does the decorative work. **No gradients, no decorative illustrations, no rainbow icon grids, no pastel blob shapes.**

**Competitive positioning:**
- Manus owns: warm-white + serif + craft-studio quiet
- Linear owns: dark + dense + monospaced + dev-tool severity
- Notion/Lindy own: friendly SaaS pastel + rounded cards
- **OrangeBench owns: warm-dark + bold sans display + confident orange + editorial layout**

---

## Color

**Approach:** Restrained. One orange, warm neutrals, semantic colors only when they carry meaning. Orange is the hero — any color block or gradient dilutes the brand.

### Core palette

| Token | Hex | Usage |
|---|---|---|
| `--ob-bg` | `#141417` | Warm near-black. Lifted from an earlier `#0B0B0C` because pure-deep felt "dev dungeon"; `#141417` still reads warm-dark but doesn't press. |
| `--ob-surface` | `#1D1D20` | Cards, sidebars, composer input container. |
| `--ob-surface-hi` | `#26262A` | Hover / elevated card state. |
| `--ob-border` | `#2F2F34` | Default border, dividers. |
| `--ob-border-strong` | `#42424A` | Hover border, emphasis divider. |
| `--ob-text` | `#F5F5F0` | Primary text — warm off-white, "paper", not sterile `#FFFFFF`. |
| `--ob-text-muted` | `#8A8A90` | Secondary text, captions, muted labels. |
| `--ob-text-dim` | `#5A5A60` | Disabled state, timestamps, least-important meta. |

### Brand

| Token | Hex | Usage |
|---|---|---|
| `--ob-orange` | `#FF5A1F` | **OrangeBench Orange.** The one and only. All "orange" code references must resolve to this. |
| `--ob-orange-hi` | `#FF7340` | Lighter tint for hover on primary CTAs (light mode) or subtle highlights. |
| `--ob-orange-lo` | `#D9471A` | Darker shade for hover on primary CTAs (dark mode) or active/pressed state. |
| `--ob-orange-a10` | `rgba(255,90,31,0.10)` | Transparent wash — badge backgrounds, hover washes, focus rings. |
| `--ob-orange-a20` | `rgba(255,90,31,0.20)` | Stronger wash — running/active step backgrounds. |

**Deprecated (remove from code):** `#FF3D00`, `#FF6B00`, `orange-500`, `orange-600` Tailwind defaults. These must all migrate to `#FF5A1F`. The invite page and login page currently use different values — this is the most visible symptom of the pre-design-system era and must be fixed.

### Semantic

**Philosophy:** warm / earthy / desaturated. The default "red-yellow-green-blue traffic-light" status palette fights the editorial brand and screams against the warm-dark canvas. Instead, the whole semantic palette lives in the warm natural-color family — sand, mustard, rust, stone. **Zero green anywhere.** Orange stays the loudest color on the page.

| Token | Hex | Usage |
|---|---|---|
| `--ob-success` | `#C9B89E` | **Warm sand / parchment.** Task completed, credit granted, test passed. Reads as "quietly done", like paper in sunlight. Not green — we tried sage `#8A9A5B` in v1.1 and even that read too green. Sand is unambiguous. |
| `--ob-warning` | `#D4A017` | **Mustard.** Running long, near quota, needs attention. Distinct from orange (yellower), editorial-feeling. |
| `--ob-error`   | `#E4483D` | **Rust red.** Task failed, validation failed, destructive confirm. Kept — red is the universal stop sign. |
| `--ob-info`    | `#9A9591` | **Warm stone.** Neutral informational state, changelog, tips. **No blue.** Blue fights the warm palette and introduces a cold axis we don't want. Stone reads as "quiet neutral" without adding another color family. |

**Do not introduce any green, pure yellow, or any blue to the codebase.** If a design requires a "done / safe" meaning, use sand. If it requires "info" or "neutral", use stone. If you feel the urge to bump saturation to match a Figma default, stop — the muted feel is the brand.

### Light mode

Light mode exists but is the secondary surface. Defaults:

| Token | Dark | Light |
|---|---|---|
| `--ob-bg` | `#141417` | `#FAF9F5` (warm paper) |
| `--ob-surface` | `#1D1D20` | `#FFFFFF` |
| `--ob-surface-hi` | `#26262A` | `#F1F0EA` |
| `--ob-border` | `#2F2F34` | `#E5E3DC` |
| `--ob-border-strong` | `#42424A` | `#C9C6BD` |
| `--ob-text` | `#F5F5F0` | `#121210` |
| `--ob-text-muted` | `#8A8A90` | `#696865` |
| `--ob-text-dim` | `#5A5A60` | `#9C9A94` |

Orange stays the same in both modes.

---

## Typography

**Approach:** Three materials doing three jobs. No Inter, no Roboto, no Helvetica, no system-font defaults. Every font choice should feel like a decision.

### Fonts

| Role | Font | Weights | Why |
|---|---|---|---|
| **Display / Wordmark / Hero** | **Cabinet Grotesk** | 700, 800 | Geometric but warm. Handles 12vw poster sizes without falling apart. Free on Fontshare. |
| **Body UI / Labels** | **Geist Sans** | 400, 500, 600 | Vercel's 2024 default. Clean, tight, replaces Inter. Free on Google Fonts. |
| **Data / Mono / Code** | **Geist Mono** | 400, 500 | Tabular nums, great for SSE streams, task IDs, credit counts. |
| **Chinese (CJK)** | **HarmonyOS Sans SC** | 400, 500, 700 | 2025+ Chinese-product default. Has personality Noto lacks. Self-host from Huawei CDN. |
| **Chinese fallback** | Noto Sans SC | 400, 500, 700 | When HarmonyOS fails to load / old Windows. Acceptable degradation. |

**Font blacklist (do not use anywhere):** Inter, Roboto, Arial, Helvetica, Lato, Montserrat, Poppins, Open Sans, system-ui as primary. If you see these in a PR, reject it.

### Loading strategy

```html
<!-- Cabinet Grotesk: Fontshare (not Google Fonts) -->
<link href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@700,800&display=swap" rel="stylesheet">

<!-- Geist + Geist Mono: Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">

<!-- HarmonyOS Sans SC: self-host from public/fonts/, with Noto Sans SC fallback from Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
```

CSS variables:

```css
:root {
  --font-display: "Cabinet Grotesk", "General Sans", system-ui, sans-serif;
  --font-body: "Geist", "HarmonyOS Sans SC", "Noto Sans SC", -apple-system, "PingFang SC", sans-serif;
  --font-mono: "Geist Mono", "SF Mono", ui-monospace, monospace;
}
```

### Type scale

| Level | Size | Line-height | Letter-spacing | Font | Use |
|---|---|---|---|---|---|
| Poster | `clamp(80px, 14vw, 220px)` | 0.82 | -0.035em | display 800 | Hero wordmark, landing posters |
| Display 1 | 88px | 0.92 | -0.03em | display 800 | Big feature headers |
| Display 2 | 64px | 0.95 | -0.025em | display 800 | Page hero |
| H1 | 40px | 1.05 | -0.02em | display 700 | Section head |
| H2 | 28px | 1.1 | -0.02em | display 700 | Subsection |
| H3 | 22px | 1.25 | -0.01em | display 700 | Card title |
| Body Lg | 18px | 1.55 | 0 | body 400 | Lede, task input |
| Body | 15px | 1.6 | 0 | body 400 | Default body |
| Body Sm | 13px | 1.55 | 0 | body 400 | Sidebar, meta |
| UI Label | 13px | 1.4 | 0 | body 500 | Form labels, nav |
| Caption | 11px | 1.3 | 0.12em | mono 500 | Uppercase section labels, timestamps |
| Data | 13px | 1.4 | 0 | mono 400, `tnum` | Tables, task IDs, credits |
| Code | 13px | 1.5 | 0 | mono 400 | Inline code, SSE payloads |

All caption labels are **ALL CAPS + monospace + 0.12em tracking**. This is an intentional editorial tic and should appear consistently (section labels, kicker text, timestamp pills, status tags).

---

## Spacing

**Base unit:** 4px. **Density:** comfortable but slightly tighter than Notion, slightly looser than Linear.

| Token | Value | Use |
|---|---|---|
| `--sp-1` | 4px | Tight gaps, icon-text |
| `--sp-2` | 8px | Default small gap |
| `--sp-3` | 12px | Input padding vertical, small card padding |
| `--sp-4` | 16px | Default medium gap, card padding |
| `--sp-5` | 24px | Section padding, card-to-card |
| `--sp-6` | 32px | Page padding, large section gap |
| `--sp-7` | 48px | Hero-to-content |
| `--sp-8` | 64px | Page-section separators |
| `--sp-9` | 96px | Marketing section breaks |

**Max content width:** `1280px` for main app layouts, `720px` for reading-width marketing copy.

---

## Layout

**Approach:** Hybrid.

- **Marketing / landing / login / invite:** Editorial asymmetric. Hero can break the grid. Poster-size typography allowed (up to 14vw).
- **App interior (`/agent`, `/tasks`, `/dashboard`, `/workspace`):** Strict 12-column grid, disciplined, information-dense. Main workspace typically runs three columns: sidebar (240px) + canvas (flex) + context panel (280px).

**Breakpoints:**

| Name | Min width | Columns |
|---|---|---|
| `sm` | 640px | 4 |
| `md` | 768px | 8 |
| `lg` | 1024px | 12 |
| `xl` | 1280px | 12 |
| `2xl` | 1536px | 12 |

---

## Border Radius

| Token | Value | Use |
|---|---|---|
| `--r-input` | 4px | Form inputs (crisp, not rounded) |
| `--r-btn` | 8px | Buttons |
| `--r-card` | 12px | Cards, panels |
| `--r-card-lg` | 16px | Large cards, composer input container |
| `--r-pill` | 9999px | Badges, pills, credit counters |

**Avoid:** uniform bubbly `rounded-2xl` on everything. The radius scale has a hierarchy — small things are sharper, big things are rounder.

---

## Motion

**Approach:** Intentional. Not expressive (this is a tool, not a toy), not minimal-functional (we want personality).

| Name | Duration | Easing | Use |
|---|---|---|---|
| micro | 80ms | `cubic-bezier(.4,0,.2,1)` | Color change, focus ring appear |
| short | 150ms | `cubic-bezier(.2,.7,.3,1)` | Hover, button press, tooltip |
| medium | 220ms | `cubic-bezier(.2,.7,.3,1)` | Modal / drawer slide, card expand |
| long | 400ms | `cubic-bezier(.4,0,.2,1)` | Page transition, route change |

**Patterns:**

- **Hover on interactive card/button:** translate Y `-1px` + subtle border color change. No scale.
- **Click / press:** translate Y `0` + brightness 95%.
- **Streaming agent thinking:** orange dot pulses at `1.5s ease-in-out` infinite, opacity 0.3 → 1 → 0.3. Used for running step indicator.
- **Never:** bouncy springs, scroll-jacking, full-page parallax, letter-by-letter typewriter animations on body text, carousels that autoplay.

---

## Component principles

### Buttons

- **Primary:** `bg-orange text-white` — the loudest affordance on the page. Use sparingly — **at most one primary CTA visible at once**.
- **Secondary:** `bg-surface-hi border-border text-text` — default secondary action.
- **Ghost:** transparent until hover. Use for "Cancel" and low-priority actions.
- **Outline orange:** `border-orange text-orange bg-transparent` — use for "+ new task" affordances where the button is structural, not action.
- **Disabled:** opacity 50% + cursor not-allowed. Do not grey out, keep the shape.
- **Minimum hit target:** 40px × 40px on touch.

### Inputs

- Radius `4px` (sharper than buttons — inputs should feel precise).
- Border `--ob-border` default, `--ob-orange` on focus, no ring — just the border color change.
- Placeholder in `--ob-text-dim`, not `--ob-text-muted` (even dimmer).
- **No floating labels.** Use label-above-input.

### Cards

- `bg-surface border-border rounded-card` default.
- Hover: border becomes `--ob-border-strong`, translate Y `-1px`.
- The composer (main task input) uses `--r-card-lg` (16px) to feel like the hero of the canvas.

### Composer (the /agent task input — hero element)

The composer is the primary visual anchor of the `/agent` workspace and must be designed as a hero element, not a utility toolbar.

**Structure:**
- Outer container: `--ob-surface`, `--r-card-lg` (16px), `--ob-border` stroke, `18px 20px 14px` padding.
- **Floating label** riding the top border: mono 10px `0.14em` tracked uppercase, in `--ob-text-muted`. Label background matches page bg (`--ob-bg`) so it cuts through the stroke cleanly. Format: `<b>AGENT</b> · 输入任务` where `AGENT` is in `--ob-orange`.
- **Textarea** (NOT a single-line input): transparent bg, no border, `min-height: 48px`, `rows="2"` default, `15px/1.55` body type. Placeholder in `--ob-text-dim`.
- **Toolbar** separated by a hairline `--ob-border` divider, `12px` padding top.

**Toolbar layout (3 zones):**
1. **Left:** tool buttons (attachments, command palette, knowledge base) each `32×32 rounded-6` icon-only ghost buttons. Then a small **model chip** — pill-shape, `--ob-surface-hi` bg, `--ob-border`, mono 11px, format: `● gpt-4o ▾` where the dot is a tiny `--ob-orange` indicator with a soft glow.
2. **Middle:** cost preview (`约 18 积分` in mono 11px dim) + keyboard hint (`⌘ ↵ 发送` where each key is its own small `kbd` element with `--ob-surface-hi` bg).
3. **Right:** the send button.

**Send button:**
- `44×44` circle, `--ob-orange` background.
- **Icon:** Lucide `send-horizontal` paper plane (2px stroke, 18px size, offset `-1px x, +1px y` to optically center inside the circle — the paper plane visually leans forward).
- Inset highlight (`rgba(255,255,255,.12)` top) + outer orange glow shadow (`0 6px 18px -6px rgba(255,90,31,.6)`) + a subtle `-2px` outer ring in `--ob-orange-alpha-20` for an extra halo.
- **No text label inside the button.** The icon carries the meaning; the `⌘ ↵ 发送` hint to the left of the button provides the verbal affordance.
- **Hover:** darkens to `--ob-orange-lo`, translate Y `-1px`, rotate `-2deg` (subtle tilt as if about to take off), stronger glow.
- **Active:** returns to rotation 0.

**Focus state (whole composer):** border becomes `--ob-orange`, adds a `0 0 0 4px` outer ring in `--ob-orange-alpha-10`. This makes the composer "light up" when the user clicks into it — a quiet but confident signal.

**Do not:**
- Replace the round send button with a rectangular "send" text button — the circular icon-only button is the brand's hero affordance.
- Use a generic up-arrow ↑ glyph. Paper plane only.
- Put model selection in a dropdown outside the composer. The chip is inline inside the toolbar.

### Badges / status

- All lowercase monospace, ALL CAPS tracked wide, pill shape.
- Status colors use the `-a10` wash backgrounds + solid semantic color text.
- The "PRO" tier badge uses `orange-a10` background + solid orange text — do not use gold/yellow.

### Wordmark

- **"ORANGE" in `--ob-orange`, "BENCH" in `--ob-text`.** Always. Never full-orange, never full-white.
- Display font, 800 weight, `-0.02em` tracking.
- In the app header, 18-20px. On marketing posters, up to 14vw.

---

## Anti-patterns (hard NO)

1. **Purple or blue gradients.** Every AI tool uses them. We don't.
2. **Rainbow icon grids / three-column feature icons.** Framer template energy.
3. **Centered everything.** Editorial asymmetry is the point.
4. **Uniform bubbly `rounded-2xl`.** Use the radius scale.
5. **Pastel hero blocks.** Orange is the one statement color.
6. **Inter, Roboto, system-ui as primary body.** Use Geist.
7. **Pure `#000000` or `#FFFFFF`.** Use the warm tokens.
8. **Two different orange values in the codebase.** One orange, `#FF5A1F`.
9. **Bouncy spring animations.** Too cute for a work tool.
10. **"Built with AI" / "Powered by AI" marketing copy.** Every competitor does it. We let the product speak.
11. **Dashed borders anywhere.** Use solid borders only. Dashed reads as "placeholder / not finished / CAD drawing" — the editorial brand wants confident solid lines. This applies to buttons, dividers, meta rows, step separators — everywhere.
12. **Primary-color semantic palette (bright green / bright yellow / pure blue).** Use the warm earthy semantic palette (sage / mustard / rust / stone). No blue anywhere in the product UI.

---

## Dark mode is the default

Dark mode is not an afterthought — it's the primary canvas. Light mode exists for printing, accessibility, and users who prefer it, but the product should be designed dark-first and the marketing site should ship dark.

When designing light mode, **do not just invert the colors.** Reduce saturation ~15% on the orange in light mode (otherwise it screams against white). Use the warm paper `#FAF9F5` instead of pure white.

---

## Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-08 | Initial DESIGN.md created | `/design-consultation` with competitive research. Eureka: no competitor owns "warm-dark + bold sans + editorial + confident orange" — that's OrangeBench's lane. |
| 2026-04-08 | Orange canonicalized to `#FF5A1F` | Previously split between `#FF3D00` (invite page) and `#FF6B00` / tailwind `orange-500` (login page). Unified to one value. |
| 2026-04-08 | Cabinet Grotesk for display, Geist for body, HarmonyOS Sans SC for CJK | Avoids overused fonts (Inter etc.) while keeping web loadable fonts. HarmonyOS Sans SC is the 2025+ Chinese-product default. |
| 2026-04-08 | Warm off-white text `#F5F5F0` + warm near-black bg (originally `#0B0B0C`) | Not pure `#000`/`#FFF`. Gives the whole product a "paper in a warm room" feel instead of CRT. |
| 2026-04-08 | Wordmark "ORANGE" orange + "BENCH" white, always | Consistent brand lockup. Never full-one-color. |
| 2026-04-08 | **v1.1 revision**: bg lifted `#0B0B0C` → `#141417`, all surface/border tokens lifted proportionally | User feedback: the original near-black felt "too deep" / "dev dungeon". The lifted value still reads warm dark but stops pressing. |
| 2026-04-08 | **v1.1 revision**: semantic palette replaced with warm earthy set | Original `#2F9E6B` (green) / `#C58B00` (yellow) / `#5B8CD6` (blue) felt like a traffic-light palette fighting the editorial warm brand. Replaced with sage `#8A9A5B` / mustard `#D4A017` / stone `#9A9591`. Red kept (`#E4483D`) as the universal stop sign. |
| 2026-04-08 | **v1.1 revision**: dashed borders banned everywhere | Original preview used `border-dashed` on the "+ new task" button, step separators, and right-panel meta rows. Solid borders only — dashed reads as "unfinished / placeholder / CAD" and fights the confident editorial tone. |
| 2026-04-08 | **v1.2 revision**: success sage `#8A9A5B` → sand `#C9B89E` | User feedback: even muted sage still read as green. Replaced with warm parchment sand, which has zero green cast and fits the editorial warm palette naturally. Zero green anywhere is now a hard rule. |
| 2026-04-08 | **v1.2 revision**: composer redesigned as hero element | v1 composer was a minor utility toolbar with broken layout ("模型" text wrapped vertically, tiny square send button). v1.2 composer has a floating "AGENT · 输入任务" label riding the top border, real multiline textarea, clean 3-zone toolbar, and a 44px circular orange send button with Lucide `send-horizontal` paper plane icon, inset highlight, outer orange glow, and a -2deg hover tilt. See the Composer section. |

---

## See also

- **HTML preview** (session artifact): `/tmp/ob-design-preview.html` — live fonts + colors + components + `/agent` workspace mockup. Open in browser.
- **Session plan file:** `~/.claude/plans/magical-roaming-sphinx.md` — full decision trail from the `/design-consultation` run.
