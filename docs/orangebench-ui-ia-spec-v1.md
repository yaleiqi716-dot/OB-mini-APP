# ORANGEBENCH Web App UI/IA Spec

> **Version**: v1.0
> **Branch**: `claude/url-driven-ui-sWSBQ`
> **Date**: 2026-04-03
> **Status**: Finalized

## Finalized Pages

The following pages are finalized. Their structure and visual language are locked. Only bug fixes and minor visual tweaks (1-2px alignment) are permitted.

| Page | Route | Template |
|------|-------|----------|
| Agent | `/agent` | Sidebar + Welcome / Chat |
| Tasks | `/tasks` | Header + Card List |
| Dashboard | `/dashboard` | Header + Stat Cards + Two-Column + Attention |
| Review | `/review` | Header + Card List |

**All future pages MUST follow this spec to prevent style drift.**

---

## 1. Navigation & Information Architecture

```
ORANGEBENCH (brand)
+-- /agent          <-- Core entry, persistent sidebar
+-- /tasks          <-- Standalone page, top header
+-- /dashboard      <-- Standalone page, top header
+-- /review         <-- Standalone page, top header
```

### Two Navigation Modes

| Mode | Pages | Structure |
|------|-------|-----------|
| **Sidebar** | `/agent` | 232px left sidebar, no top header |
| **Header** | `/tasks` `/dashboard` `/review` | 52px top bar, full-width content |

### Header Bar (for /tasks, /dashboard, /review)

| Property | Value |
|----------|-------|
| Height | 52px |
| Background | `#F7F7F4` |
| Bottom border | `1px solid #E7E5E1` |
| Left | ORANGEBENCH brand (ORANGE `#F97316` + BENCH `#171717`, 15px/700) |
| Right | Nav links (13px, inactive `#9CA3AF`, active `#F97316` + `rgba(255,122,26,0.10)` bg) |

### Sidebar (for /agent only)

| Property | Value |
|----------|-------|
| Width | 232px |
| Background | `#F3F2EE` |
| Right border | `1px solid #E7E5E1` |
| Brand area | 56px height, ORANGEBENCH 24px/700, sub "AI AGENT" 11px `#9CA3AF` letterSpacing 0.08em |
| New chat button | 44px height, r16, `#F97316` bg, white text, 15px/600 |
| Search box | 36px height, r12, white bg, `#E7E5E1` border |
| History items | 36px height, 12.5px font, active = `rgba(255,122,26,0.06)` + left 2px orange line + weight 550 |
| Group labels | 11px `#A3A3A3`, top padding 16px |
| Footer nav | Tasks / Settings / Account, 32px row height, 13px `#6B7280` |

---

## 2. Global Visual Tokens

### Backgrounds

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#F7F7F4` | Page background |
| `--bg-sidebar` | `#F3F2EE` | Sidebar background |
| `--bg-card` | `#FFFFFF` | All cards |
| `--bg-tertiary` | `#FBFBFA` | Result inner area, code blocks |

### Borders

| Token | Value | Usage |
|-------|-------|-------|
| `--border` | `#E7E5E1` | Universal border |
| `--border-light` | `#F0EDE8` | List separators |

### Brand Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--accent` | `#F97316` | Primary orange, CTA, active states, brand |
| `--accent-hover` | `#E8680F` | Orange hover (8% darker) |
| `--accent-subtle` | `rgba(255,122,26,0.10)` | Light orange background (chip active, badge) |
| `--accent-ring` | `0 0 0 3px rgba(255,122,26,0.12)` | Focus ring |
| `--user-bubble` | `#EB8434` | User message bubble (desaturated orange) |

### Text Colors

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#171717` | Titles, key body text |
| Secondary | `#6B7280` | Descriptions, secondary info |
| Muted | `#9CA3AF` | Placeholders, timestamps, helpers |
| Faint | `#A3A3A3` | Empty states, group labels |
| Subtitle | `#7A7A7A` | Page subtitles (dedicated) |
| Body | `#404040` | Result card body text |
| Status: Running | `#C2410C` | Running badge and text |
| Status: Completed | `#047857` | Completed badge |
| Status: Failed | `#B91C1C` | Failed badge and text |
| Error title | `#C2410C` | Error card titles |

### Type Scale

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| Page title (agent) | 44px | 600 | Homepage hero |
| Page title (subpage) | 32px | 600 | /tasks, /dashboard, /review |
| Card title | 17px | 600 | Task cards, result cards, section headings |
| Body | 14px | 400 | AI descriptions, result body |
| Secondary | 13px | 400-500 | Summaries, chips, buttons |
| Small | 12px | 400 | Timestamps, status descriptions |
| Micro | 11px | 500 | Badges, group labels |

**Minimum font size: 12px** (accessibility requirement)

### Border Radius

| Element | Value |
|---------|-------|
| Large input (homepage) | 24px |
| Chat input (conversation) | 20px |
| Cards / result cards / stat cards | 16px |
| Result inner / search box / step container | 12px |
| General buttons / sidebar buttons | 8-16px |
| Chips / badges / action buttons / Auto badge | 9999px |

### Shadows

| Context | Value |
|---------|-------|
| Homepage input | `0 8px 24px rgba(0,0,0,0.04)` |
| Homepage input hover | `0 10px 28px rgba(0,0,0,0.06)` |
| Result card | `0 4px 14px rgba(0,0,0,0.04)` |
| Card hover | `0 8px 20px rgba(0,0,0,0.05)` |
| Capability card hover | `0 6px 16px rgba(0,0,0,0.05)` |
| Mobile sidebar | `0 10px 30px rgba(0,0,0,0.08)` |
| Everything else | none |

### Motion

| Property | Value |
|----------|-------|
| Standard transition | `200ms ease` |
| fadeUp animation | `0.2s ease-out` |
| Hover lift | `translateY(-1px)` |
| `prefers-reduced-motion` | All animations disabled |

---

## 3. Component Specs

### Buttons

#### Action Button (View / Continue / Retry)

| Property | Value |
|----------|-------|
| Height | 30px |
| Border-radius | 9999px |
| Font | 12px / 500 |
| Padding | 0 12px |
| Default | white bg + `1px solid #E7E5E1` + `#6B7280` text |
| Hover | `rgba(255,122,26,0.06)` bg + `rgba(255,122,26,0.3)` border + `#F97316` text |
| Failed variant | Default color `#B91C1C` |

#### Primary CTA (New Chat, Go to Agent)

| Property | Value |
|----------|-------|
| Height | 36-44px |
| Border-radius | 9999px (capsule) or 16px (sidebar) |
| Background | `#F97316`, hover `#E8680F` |
| Text | white, 14-15px / 500-600 |

#### Send Button

| Property | Value |
|----------|-------|
| Size | 36x36px circle |
| Active | `#F97316` bg + white arrow |
| Disabled | `#D0D0D0` bg |

### Chips (Filters / Tags)

| Property | Value |
|----------|-------|
| Height | 32px |
| Border-radius | 9999px |
| Font | 13px |
| Padding | 0 14px |
| Gap | 8px |
| Default | white bg + `1px solid #E7E5E1` + `#6B7280` text |
| Active | `rgba(255,122,26,0.10)` bg + `#F97316` text + no border |
| Hover (homepage) | light orange bg + `rgba(255,122,26,0.25)` border |

### Status Badge

| Property | Value |
|----------|-------|
| Height | 22px |
| Border-radius | 9999px |
| Padding | 0 10px |
| Font | 11px / 500 |

| Status | Background | Text |
|--------|-----------|------|
| Running | `rgba(255,122,26,0.10)` | `#C2410C` |
| Completed | `rgba(16,185,129,0.10)` | `#047857` |
| Failed | `rgba(239,68,68,0.10)` | `#B91C1C` |

### Input Boxes

#### Large Input (Homepage Hero)

| Property | Value |
|----------|-------|
| Min height | 148px |
| Max width | 720px |
| Border-radius | 24px |
| Background | white, `1px solid #E7E5E1` |
| Focus | orange border + focus ring |
| Shadow | `0 8px 24px rgba(0,0,0,0.04)` |
| Toolbar | attach + tools left, Auto + send right |
| Placeholder | 15px `#A3A3A3` |

#### Chat Input (Conversation)

| Property | Value |
|----------|-------|
| Min height | 72px |
| Border-radius | 20px |
| Padding | 14px |
| Focus / toolbar | same as large input |

#### Search Box (Sidebar + Subpages)

| Property | Value |
|----------|-------|
| Height | 36px |
| Border-radius | 12px |
| Background | white, `1px solid #E7E5E1` |
| Left icon | search, 16px |
| Focus | orange border + ring |

### Cards

#### Task Card (/tasks, /review)

| Property | Value |
|----------|-------|
| Background | `#FFFFFF` |
| Border | `1px solid #E7E5E1` |
| Border-radius | 16px |
| Padding | 18px |
| Min height | 96px (tasks) / 124px (review) |
| Hover | `translateY(-1px)` + `0 8px 20px rgba(0,0,0,0.05)` |
| Left | title 17px/600 + summary 13px/#6B7280 max 2 lines + time 12px/#A3A3A3 |
| Right | action buttons, vertical stack |

#### Result Card (/agent chat)

| Property | Value |
|----------|-------|
| Background | `#FFFFFF` |
| Border | `1px solid #E7E5E1` |
| Border-radius | 16px |
| Shadow | `0 4px 14px rgba(0,0,0,0.04)` |
| Header | 16px 24px padding, border-bottom |
| Body | 24px padding |
| Inner | `#FBFBFA`, r12, p18, no border, text `#404040` lh1.75 |

#### Stat Card (/dashboard)

| Property | Value |
|----------|-------|
| Background | `#FFFFFF` |
| Border | `1px solid #E7E5E1` |
| Border-radius | 16px |
| Padding | 18px |
| Height | 108px |
| Number | 28px / 650 |
| Label | 13px / `#6B7280` |

#### Capability Card (/agent homepage)

| Property | Value |
|----------|-------|
| Background | `#FFFFFF` |
| Border | `1px solid #E7E5E1` |
| Border-radius | 16px |
| Padding | 18px |
| Height | 104px |
| Icon container | 24x24, light orange bg |
| Title | 17px / 600 |
| Description | 12px / `#6B7280` |
| Hover | `translateY(-1px)` + light shadow |

#### Error Card

| Property | Value |
|----------|-------|
| Background | `#FFF7F5` |
| Border | `1px solid #F5D0C5` |
| Border-radius | 16px |
| Padding | 16px |
| Title | 14px / 600 / `#C2410C` |
| Description | 13px / `#6B7280` |
| Retry button | capsule, accent-subtle bg |

#### Step Container (/agent chat)

| Property | Value |
|----------|-------|
| Background | `#FCFCFB` |
| Border | `1px solid #ECE9E4` |
| Border-radius | 12px |
| Padding | 6px 8px |
| Step height | 28px |
| Current step | light orange bg + orange dot |
| Completed step | green dot |

### Empty State

Unified pattern: centered, no illustrations.

```
[ 48px white icon box, r16 ]
     Title: 16px / 600 / #171717
     Description: 14px / #7A7A7A
     [ Orange capsule button ]
```

Per-page copy:

| Page | Title | Description | Button |
|------|-------|-------------|--------|
| /agent sidebar | 暂无历史对话 | -- | -- |
| /tasks | 还没有任务记录 | 去 Agent 交给 ORANGEBENCH 一个任务吧 | 去 Agent |
| /dashboard | Stat values show 0, sections show placeholder text | -- | -- |
| /review | 当前没有需要处理的任务 | 新的完成结果、失败任务或执行中的项目会出现在这里 | 去 Tasks |

---

## 4. Page Templates

### Agent Template

```
+-------------------------------------------+
| [232px Sidebar]  |  [Main Content]        |
| Brand            |                        |
| New Chat (44px)  |  Welcome / Chat        |
| Search (36px)    |  max-width 780px       |
| Grouped History  |                        |
| --------------- |                        |
| Tasks/Settings/  |  [Bottom Input]        |
| Account          |                        |
+-------------------------------------------+
```

Two states:
- **Welcome**: hero title + large input + chips + capability cards
- **Chat**: message flow + step container + result card + bottom input

### Tasks / Review Template

```
+--------------------------------------+
| [52px Header]                        |
+--------------------------------------+
| max-width 980px, padding 40px 32px   |
|                                      |
| Title 32px/600     [Search 220px]    |
| Subtitle 14px #7A7A7A               |
|                                      |
| [chip] [chip] [chip] [chip]          |
|                                      |
| [Card] gap 14px                      |
| [Card]                               |
| [Card]                               |
+--------------------------------------+
```

### Dashboard Template

```
+--------------------------------------+
| [52px Header]                        |
+--------------------------------------+
| max-width 1100px, padding 40px 32px  |
|                                      |
| Title 32px/600     [Time chips]      |
| Subtitle 14px #7A7A7A               |
|                                      |
| [Stat][Stat][Stat][Stat] 4-col h108  |
|                                      |
| [Recent 1fr] [AI Summary 1.1fr]     |
|                                      |
| [Needs Attention -- full width]      |
+--------------------------------------+
```

---

## 5. Prohibited

| Prohibited | Reason |
|------------|--------|
| Table layouts | Creates admin-panel feel, conflicts with product positioning |
| Heavy shadows (> 0.08 opacity) | Breaks lightweight aesthetic |
| Multiple color systems | Existing 5-level grey + 3 status colors are sufficient |
| Exposing internal variable names (API_KEY etc.) | Use product copy: "当前能力暂不可用" |
| Billing / payment main entry | Not shown until WeChat Pay is configured |
| Nav entries beyond Agent/Tasks + current page | Keep header nav minimal |
| Large illustration empty states | Use 48px icon + copy + button |
| Charts (line, pie, bar) | Dashboard uses number cards + text summary |
| Approve/reject approval buttons | Review is not an approval system |
| Full-card colored backgrounds for status | Badge only; card stays white |
| Animations when `prefers-reduced-motion` is set | Must be fully disabled |
| Text below 12px | Accessibility requirement |
| Icon buttons without `aria-label` | Accessibility requirement |
| Multiple co-existing visual styles | One system for all pages |

---

## 6. Error & Status Copy

All user-facing error messages must use product-friendly copy. Never expose internal details.

| Scenario | Copy |
|----------|------|
| Image generation unavailable | 图片生成功能暂未开启 |
| Video generation unavailable | 视频生成功能暂未开启 |
| Generic capability error | 当前能力暂不可用 |
| Error description | 请稍后重试，或联系管理员启用该能力 |
| Credits insufficient | 额度不足，充值后任务会自动恢复 |
| Running task (review page) | AI 正在继续处理这项任务 |

---

*This spec is derived from the finalized codebase on branch `claude/url-driven-ui-sWSBQ`. It is not a design mockup -- every value listed here is implemented and shipped.*
