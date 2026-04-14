# OrangeBench Skills Integration Plan v1.0

**Version**: v1.0 — Planning Document
**Branch**: `claude/url-driven-ui-sWSBQ`
**Date**: 2026-04-09
**Status**: Planning (not yet in code)
**Author**: drafted by Claude in response to solo founder request

## Bottom line

OrangeBench's product vision ("AI 专业技能角色补足团队能力" + "员工 + AI 协作完成老板发布的任务") has been articulated clearly. The gap is not vision, it's the runtime layer between AGENT and the actual specialized capabilities. This doc specifies how to fill that gap using four external assets, in order of shipping complexity:

1. **agency-agents-zh** — 191 pre-written Chinese role personas (immediate win, ~3-5 days)
2. **gstack browse + design binaries** — web automation + visual mockup generation (~1 week)
3. **Zapier preset workflows** — plug OB into 5000+ external apps via curated templates (~2 weeks)
4. **MCP for end users** — user-installable external tool connectors (~3-4 weeks)

None of these require the architectural "SKILLS + MCP" layer we discussed earlier to exist as a full abstraction first. Each can be shipped as a thin adapter on top of the existing AGENT dispatch pipeline, accumulating toward a real skills runtime over 2 months without a big-bang rewrite.

This is the boil-the-lake path: 4 integrations, each independently valuable, each shippable without waiting for the others, together delivering the "AI 同事 + 外部工具 + 自动化工作流" story the user vision requires.

## Why this order

The sequencing is **value density per shipping day**, not technical dependencies.

| Rank | Integration | Days to first user value | Depends on anything? | Risk |
|------|-------------|--------------------------|----------------------|------|
| 1 | agency-agents-zh | 3-5 days | Nothing — it's pure data | Low |
| 2 | gstack binaries | 5-7 days | Worker runtime must execute binaries | Medium (binary lifecycle) |
| 3 | Zapier workflows | 10-14 days | OB must expose public API + register Zapier app | Medium (external approval) |
| 4 | MCP for end users | 20-30 days | Needs credential vault + permission UI + MCP client runtime | High (supply chain, security) |

Shipping (1) alone gives OrangeBench a differentiator that none of ChatGPT, Monday, or Manus have: **selectable Chinese professional AI colleagues, pre-written, ready to use**. That's a demo-able wedge in under a week.

## Integration 1: agency-agents-zh → OrangeBench "AI 同事"

### What this unlocks

OrangeBench users get a **role picker** in the composer. Before typing a prompt, they can select an "AI colleague" persona — the agent now responds from that professional perspective. Examples:

- 小王(founder)想写朋友圈文案 → 选 "@小红书运营专家" → composer 自动套上品牌语气 + 种草笔记框架
- 运营小李要做周报 → 选 "@数据分析师" → 输出结构化的数据洞察而不是聊天
- 老板审核员工交付 → 选 "@Supervisor 资深项目经理" → 拿到专业意见而不是 yes-man

This is the **"补足团队能力"** story from your product vision, delivered without any schema revolution. It's just a new dropdown in the composer + a prompt prefix injection.

### What's in the asset

```
agency-agents-zh/
├── AGENT-LIST.md          (191 agents total, 17 departments)
├── design/                (8 agents — UX 架构师 / 品牌守护者 / UI 设计师 / ...)
├── engineering/           (30 agents — 后端架构师 / 移动开发 / DevOps / ...)
├── marketing/             (34 agents — 小红书 / 抖音 / 微信公众号 / 知乎 / ...)
├── paid-media/            (7 agents — PPC / 程序化 / 社交广告 / ...)
├── sales/                 (8 agents — 销售教练 / Discovery 教练 / 赢单策略师 / ...)
├── hr/                    (2 agents — 招聘专家 / 绩效管理)
├── product/               (5 agents — PM / PRD / 反馈分析师 / ...)
├── legal/                 (2 agents — 合同审查 / 制度文件撰写)
├── finance/               (3 agents — 财务预测 / 风控 / 发票管理)
├── support/               (8 agents — 客服 / 工单分析 / ...)
└── ... 10 more departments
```

Each agent is a `.md` file with this exact shape (confirmed by reading `design/design-brand-guardian.md`):

```markdown
---
name: 品牌守护者
description: 专精品牌形象开发...
color: blue
---

# 品牌守护者 Agent 人格
你是 **品牌守护者**...
## 你的身份与记忆...
## 你的核心使命...
## 你必须遵守的关键规则...
```

This is **pure data with known structure**. Zero runtime, zero dependencies, zero install.

### Integration approach — "Role Library"

Add to OrangeBench:

**Schema changes** — minimal, 2 new fields on existing tables:

```prisma
model Conversation {
  // ... existing
  skillRoleId  String?  // active AI colleague persona for this conversation
}

model WorkspaceTask {
  // ... existing
  preferredSkillRoles  String?  // JSON array: ['marketing-xiaohongshu', 'design-brand-guardian']
                                //            suggested roles for members to use on this task
}
```

**No new tables required.** The 191 agent definitions live as static markdown files in the repo under `src/skills/agency-agents/` (moved from the untracked `agency-agents-zh/` dir).

**New code** (rough breakdown):

```
src/lib/skills/
├── loader.ts         (15 lines — read .md file, parse frontmatter, return { id, name, description, systemPrompt })
├── registry.ts       (20 lines — build in-memory map at boot, sorted by department)
├── search.ts         (10 lines — fuzzy match by name or description, for picker UI)
└── applyRole.ts      (10 lines — inject systemPrompt as prefix on agent task's input)

src/app/api/skills/
└── route.ts          (GET /api/skills — returns list of {id, name, description, department} for picker)

src/components/agent/
└── SkillRolePicker.tsx  (dropdown UI — category filter + search, ~150 lines)
```

**Runtime integration point** — one place:

In `src/app/api/tasks/route.ts` (agent task creation), when `conversation.skillRoleId` is set, prepend the role's system prompt to the task input before queueing it to the worker. That's it.

```ts
// src/app/api/tasks/route.ts  (conceptual — simplified)
const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
let finalInput = rawInput;
if (conversation?.skillRoleId) {
  const role = await loadSkillRole(conversation.skillRoleId);
  finalInput = `${role.systemPrompt}\n\n---\n\n【用户任务】\n${rawInput}`;
}
```

**UI changes** — one dropdown above the composer:

```
┌─ /agent composer ───────────────────────────────────────┐
│                                                         │
│  [AI Colleague: 未选 ▾]  ← new dropdown                │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 输入任务...                                      │   │
│  │                                                 │   │
│  └─────────────────────────────────────────────────┘   │
│  [📎] [@ mention]              [gpt-4o ▾]  [↵ 发送]   │
└─────────────────────────────────────────────────────────┘
```

Dropdown opens a searchable picker:

```
┌─ 选 AI 同事 ────────────────────────────────────────┐
│  [🔍 搜索角色...                                 ]  │
│                                                      │
│  📱 社媒运营 (7)                                    │
│    ● 小红书运营专家        ─ 种草 · 生活方式 · 转化  │
│    ● 抖音策略师            ─ 短视频 · 算法 · 直播   │
│    ● 微信公众号运营        ─ 长文 · 私域 · 裂变     │
│                                                      │
│  ✍️  内容创作 (5)                                    │
│    ● 内容创作者            ─ 多平台 · 叙事 · 结构   │
│    ● 图书联合作者          ─ 长文 · IP · 思想领袖   │
│    ...                                               │
│                                                      │
│  💼 销售 (8)                                        │
│    ...                                               │
└──────────────────────────────────────────────────────┘
```

### Why this is a week of work, not a month

- 191 files × 1 parser = nothing to build beyond a frontmatter reader
- No new state machines, no new API surface beyond one GET endpoint
- No worker changes — same dispatch pipeline, just a longer input
- No billing/credit implications — the existing per-task credit model applies
- Static assets, bundled with the Next.js build, no CDN or storage needed

Risk: prompt-length budget. Some agent personas are ~500 tokens. If a task input is already 2k tokens and we prepend 500, we eat into context budget. Mitigation: truncate role prompts to ~300 tokens, or load them as `system` role on OpenRouter instead of prepending to `user` input.

### Success criteria

- **Day 5**: user can pick a role, send a task, see clearly different output shape depending on role
- **Day 10**: workspace task can suggest 2-3 default roles ("for this task, try @小红书运营 or @品牌守护者"), assignee sees them as chips on the task detail page
- **Day 14**: analytics show which roles are used most — this becomes the input signal for future skill investment

## Integration 2: gstack browse + design binaries → OrangeBench tools

### What this unlocks

Once the AI colleague layer works, users will immediately ask: **"它能真的替我操作吗?"** — not just "write me a draft" but "actually go to the Taobao backend, pull this week's sales data, and come back with it". That's what gstack's `browse` binary does. Same for visual output: users want "generate 3 Xiaohongshu post cover variants in my brand style" — that's what gstack's `design` binary does.

These are the two highest-leverage external capabilities OrangeBench is missing today:

- **Web automation** — no more "open 5 platforms by hand to pull weekly numbers"
- **Visual generation** — no more "describe the image you want in words and pray"

### What's in the asset

**gstack browse** (`~/.claude/skills/gstack/browse/dist/browse`):
- A single compiled binary (~10-15 MB)
- Subcommands: `goto`, `screenshot`, `snapshot`, `click`, `fill`, `eval`, `wait`, `css`, `responsive`, `perf`
- Runs a headless Chromium internally (Playwright-based)
- Outputs images/JSON to stdout or files
- ~100ms per command (fast enough to be used mid-conversation)

**gstack design** (`~/.claude/skills/gstack/design/dist/design`):
- Same compiled binary shape
- Subcommands: `generate`, `variants`, `compare`, `check`, `iterate`, `extract`
- Calls AI image generation providers (Gemini 2.5 Flash Image etc.) with structured design briefs
- Outputs PNG files + JSON metadata
- ~10-40 seconds per generation depending on provider

Both are **solo executables** — no npm install, no service to run, no port to reserve.

### Integration approach — "Agent tool calls"

This is the first integration that requires a real tool-use layer inside the agent dispatcher. Today the dispatcher routes to `handleText` / `handleImage` / `handlePlan`. We add `handleBrowse` and `handleDesign` as new dispatch branches, each shelling out to the binary.

**Schema changes** — add tool artifacts to the existing `TaskEvent` table (no new table):

```prisma
model TaskEvent {
  // ... existing
  toolName   String?   // 'browse.screenshot' | 'design.variants' | ...
  toolInput  String?   // JSON
  toolOutput String?   // path to file or raw JSON result
}
```

**Runtime integration** — 3 new files:

```
src/services/tools/
├── browse.ts    (~80 lines — spawn binary, pipe args, capture stdout, handle timeouts)
├── design.ts    (~80 lines — same shape, different subcommands)
└── index.ts     (~30 lines — tool registry, maps tool_name → handler function)

src/services/agent/
└── dispatch.ts  (edit — add 'browse' and 'design' intent handling, route to tool runtime)
```

**Intent detection** — the agent decides when to call a tool:

Current dispatcher uses LLM intent routing (`src/services/agent/dispatch.ts` line ~33). We extend the intent enum:

```ts
type Intent = 'text' | 'image' | 'plan' | 'browse' | 'design' | 'tool_chain';
```

When intent = `browse`, the LLM receives the browse tool's function signature and emits a tool call like `{ tool: 'browse.screenshot', url: '...', element: '...' }`. The dispatcher executes it, captures the result, and either returns it to the user or feeds it back into the LLM for a follow-up (tool_chain intent).

**UI changes** — minimal. The agent surface shows tool results inline as cards:

```
┌─ Agent 回复 ────────────────────────────────────────┐
│                                                      │
│  好,我帮你从淘宝后台拉本周销售数据。                  │
│                                                      │
│  🌐 正在访问 taobao.com/seller/...                  │
│                                                      │
│  📸 [screenshot 缩略图]                              │
│     taobao-dashboard.png · 1440x900 · 2s            │
│                                                      │
│  已拉到数据:                                         │
│  • GMV ¥287,450 (上周 ¥232,800, +23.5%)            │
│  • 订单 1,847 单                                     │
│  ...                                                 │
└──────────────────────────────────────────────────────┘
```

### Security model

This is where gstack integration stops being trivial. Running a browser on behalf of a user, inside a worker process, touches several things:

- **Credential storage** — if the user wants "pull my Taobao sales", the worker needs their Taobao cookies. These must be encrypted at rest (KMS or libsodium), scoped per-user, and never logged.
- **Worker isolation** — a compromised browse session must not be able to read other users' data. This means per-task worker processes, not shared threads.
- **Rate limiting + cost caps** — browse costs ~100ms but can be abused (user could ask agent to browse 10k pages). Need per-user daily cap.
- **Whitelist vs blacklist** — do we allow arbitrary URLs, or only a curated list of "supported" sites with known selectors? MVP: whitelist of 10-20 Chinese business platforms (淘宝 / 抖音 / 公众号 / 飞书 / 企微 / 钉钉 / 小红书 / B 站 / 知乎 / 微博 / 邮箱 /...).

For **design** binary it's much simpler — no credentials needed, only API keys for image providers, which OB already manages centrally.

### Recommendation: ship `design` first, `browse` second

The design binary has **none of the security headaches** above and produces an immediate visual "wow" moment. Shipping it gives the product a unique feature (AI mockup generation in Chinese) that neither ChatGPT nor Claude.ai has in a workspace context. Browse can come 1-2 weeks later once the per-user credential vault is designed.

### Success criteria

- **Week 1 (design only)**: user asks "给我做 3 张小红书封面,主题是秋冬护肤",agent returns 3 variants inline
- **Week 2 (browse MVP, whitelist only)**: user asks "拉一下本周淘宝后台 GMV",agent screenshots + extracts numbers, returns them in a card
- **Week 3**: workspace task integration — "帮我分析这个任务对应的数据" triggers browse tool automatically based on task description

## Integration 3: Zapier preset workflows → OrangeBench automation

### What this unlocks

Two directions matter to end users:

**Outbound (OB → other apps)**:
- Task completed in OB → post to Slack / 钉钉 / 企微
- Task submitted → append to Notion database / Airtable
- Weekly report generated → email it to owner's Gmail + attach to Google Drive
- AI colleague output → auto-post to WordPress / Ghost / 公众号 draft

**Inbound (other apps → OB)**:
- New email in Gmail with subject "请做" → create OB task
- New row in Google Sheets → create workspace task
- Calendar event 24h before → create reminder task
- Slack message mentioning @bot → create task in current user's workspace
- Payment received in Stripe → create follow-up task for fulfillment

Between these two, **outbound is the higher ROI first** because it piggy-backs on user workflows already running in their other tools, and it doesn't require OB to receive unknown input.

### What's in the asset

Zapier has two integration paths, and the right choice depends on stage:

| Path | What it is | Who approves | Time to first user | OB positioning |
|------|------------|--------------|---------------------|----------------|
| **Webhooks by Zapier** | Generic HTTP webhook; user copies/pastes a URL | Nobody | 0 days (works now) | "Connect with any app via Zapier" |
| **Zapier Platform app** | Published app in Zapier's directory with auth + triggers + actions | Zapier review (1-2 weeks) | 2-4 weeks | "Official OrangeBench integration" |

For a solo founder at current stage, **start with Webhooks by Zapier**. It gives users the full 5000+ app ecosystem immediately with zero platform approval, and you can upgrade to a published app later without breaking existing workflows.

### Integration approach — "Webhook recipes"

**Schema additions** — 2 new tables:

```prisma
model WebhookEndpoint {
  id          String   @id @default(cuid())
  userId      String
  name        String   // user-facing: "Slack #team 通知"
  url         String   // the zapier webhook URL user pasted
  events      String   // JSON array: ['task_completed', 'task_submitted']
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  lastFiredAt DateTime?
  failureCount Int @default(0)
  @@index([userId, active])
}

model WebhookLog {
  id         String   @id @default(cuid())
  endpointId String
  event      String
  payload    String   // JSON
  statusCode Int?
  errorMsg   String?
  firedAt    DateTime @default(now())
  @@index([endpointId, firedAt])
}
```

**New code**:

```
src/services/webhooks/
├── dispatcher.ts   (~60 lines — fires outbound webhooks, retries 3x with exponential backoff)
├── payloads.ts     (~40 lines — shapes the JSON payload for each event type)
└── index.ts

src/app/api/webhooks/
├── route.ts        (CRUD for user's webhook endpoints)
└── test/route.ts   (test-fire endpoint for "Test Webhook" button in UI)

src/app/account/integrations/
└── page.tsx        (~200 lines — lists endpoints, add/edit/delete, paste Zapier URL, pick events)
```

**Integration points in existing flow**:

Anywhere that currently calls `createNotification()` in `src/services/wecom.ts`, we also call `fireWebhooks(userId, event, payload)`. The event types are the same 4 already defined:

- `task_assigned` — boss assigned task → fires to assignee's webhooks
- `task_submitted` — employee submitted → fires to boss's webhooks
- `task_revision` — boss sent back for revision → fires to employee's webhooks
- `task_completed` — boss approved → fires to both sides' webhooks

Plus 2 new general events:
- `agent_task_completed` — any agent task finishes → user's webhooks
- `workspace_invite_accepted` — new member joined → owner's webhooks

**Preset Zap templates** — this is where the user-facing value lives. OrangeBench publishes a small gallery:

```
┌─ Integrations · Zapier Templates ───────────────────┐
│                                                      │
│  📢 Slack 任务完成通知                              │
│     任务完成后,自动发到你的 Slack 频道              │
│     [ 一键设置 ]                                     │
│                                                      │
│  📝 Notion 交付物归档                               │
│     员工提交交付后,自动存入 Notion 数据库           │
│     [ 一键设置 ]                                     │
│                                                      │
│  📅 Google 日历提醒                                  │
│     任务截止前 24h,自动在日历上建提醒                │
│     [ 一键设置 ]                                     │
│                                                      │
│  📧 Gmail 周报自动发送                               │
│     每周五 17:00,自动把周报发给老板                 │
│     [ 一键设置 ]                                     │
│                                                      │
│  📊 Google Sheets 任务日志                          │
│     所有 OB 任务自动记录到 Sheets                   │
│     [ 一键设置 ]                                     │
└──────────────────────────────────────────────────────┘
```

"一键设置" opens a 3-step wizard:
1. "去 Zapier 登录并创建这个 Zap" → opens Zapier template URL (pre-filled with OB webhook trigger)
2. "复制你的 Webhook URL" → user pastes back into OB
3. "测试发送" → OB fires a test payload, user sees it arrive in Zapier

### Success criteria

- **Week 1**: 10 curated Zap templates live in `/account/integrations`
- **Week 2**: at least 3 users have active webhooks firing on real events
- **Month 1**: analytics show event → Zapier delivery rate >99%, failure webhooks auto-disable after 5 failures with notification to user

### Zapier Platform app upgrade path (future)

Once 20+ users are regularly using webhooks, publishing an official Zapier app is worth the 1-2 week investment. That enables:

- OB as a **trigger** in Zapier's visual builder (no manual URL pasting)
- OB as an **action** (other Zaps can create OB tasks)
- Zapier's OAuth handles user auth end-to-end
- OB appears in Zapier's app directory → discoverable by Zapier's 2M+ user base

Don't do this on day 1. Do it when you have proof people want it.

## Integration 4: MCP for end users → OrangeBench "My AI Tools"

### What this unlocks

Zapier is "if-this-then-that" — stateless, one-shot. MCP is different: it lets the OrangeBench AI agent **reach into your personal tools on demand**, during a conversation, as part of task execution.

Example difference:

- **Zapier way**: "every time I finish a task in OB, append it to my Notion" — fixed, one direction
- **MCP way**: user asks agent "把上周我在 Notion 里写的那份产品方案拿过来,改成一份给销售团队的话术" — the agent reads the doc, transforms it, the user sees the new doc, all in one conversation

MCP is what turns the agent from "text generator" into "actual assistant that uses your stuff". It's the closest thing to what people imagine when they say "AI employee".

### Why this is Phase 4

Unlike the first 3 integrations, MCP for end users is genuinely complex because it touches:

1. **Per-user credential vault** — each user's MCP configs (API keys, OAuth tokens, endpoints) must be stored encrypted and scoped
2. **MCP client runtime** — the worker needs to spawn MCP server processes on demand, route tool calls through them, clean up after
3. **Permission UI** — user must approve each MCP server's scope before it runs (read-only? write? admin?)
4. **Sandbox + cost control** — unbounded MCP calls can rack up bills; need rate limits per MCP per user per day
5. **Supply chain security** — installing an MCP server is installing code. If OB offers a catalog, OB implicitly vouches for safety. This is a real legal + security concern.

Because of this, MCP should not be the first thing shipped. It should be last, after the product has real users and you understand which external tools they actually want.

### Integration approach — "Personal tools"

**Schema additions** — 3 new tables:

```prisma
model McpServer {
  id            String   @id @default(cuid())
  userId        String
  name          String   // user-facing: "My Notion"
  kind          String   // 'notion' | 'gdrive' | 'gmail' | 'airtable' | 'custom'
  transport     String   // 'stdio' | 'sse' | 'http'
  command       String?  // for stdio: e.g., 'npx @modelcontextprotocol/server-notion'
  endpoint      String?  // for sse/http: URL
  configEncrypted String // encrypted JSON blob of env vars / tokens
  scopes        String   // JSON array: ['read', 'write']
  enabled       Boolean  @default(true)
  lastUsedAt    DateTime?
  @@index([userId, enabled])
}

model McpUsageLog {
  id            String   @id @default(cuid())
  mcpServerId   String
  userId        String
  toolName      String
  input         String   // JSON, may be truncated
  output        String?  // JSON, may be truncated
  statusCode    Int
  durationMs    Int
  firedAt       DateTime @default(now())
  @@index([userId, firedAt])
}

model McpPermission {
  id            String   @id @default(cuid())
  userId        String
  mcpServerId   String
  grantedAt     DateTime @default(now())
  expiresAt     DateTime?
  scopes        String   // JSON
}
```

**Worker runtime changes**:

```
src/services/mcp/
├── runtime.ts       (~200 lines — spawn MCP server process, manage lifecycle, timeout, kill)
├── client.ts        (~150 lines — JSON-RPC MCP protocol client)
├── catalog.ts       (~50 lines — curated list of "installable" MCP servers)
├── credentials.ts   (~80 lines — encrypt/decrypt credential blobs with KMS)
└── dispatcher.ts    (~60 lines — route agent tool calls to appropriate MCP server)

src/app/api/mcp/
├── route.ts                   (list user's MCP servers)
├── install/route.ts           (install from catalog)
├── [id]/route.ts              (get/update/delete)
├── [id]/test/route.ts         (test connection)
└── [id]/tools/route.ts        (list tools exposed by this server)

src/app/account/ai-tools/
└── page.tsx         (~400 lines — MCP server catalog + installed list + install wizard)
```

**Curated catalog** for MVP (10 MCPs to start):

| MCP | What it does | Credential type | Priority |
|-----|--------------|-----------------|----------|
| Notion | Read/write pages and databases | OAuth | P0 |
| Google Drive | Read/write files | OAuth | P0 |
| Google Sheets | Read/write spreadsheets | OAuth | P0 |
| Gmail | Read/send email | OAuth | P0 |
| Airtable | Read/write databases | API key | P1 |
| 飞书多维表格 | Read/write Feishu Bitables | OAuth | P0 (China users) |
| 飞书云文档 | Read/write Feishu docs | OAuth | P0 (China users) |
| 企业微信 | Send messages | API key | P1 |
| Jira | Read/create issues | API token | P2 |
| GitHub | Read repos + issues | OAuth | P2 |

The rest of the MCP ecosystem is accessible via "Custom MCP" — user pastes a command or endpoint. Power users only, with big warnings.

**UI** — a dedicated page under account center:

```
┌─ /account/ai-tools ─────────────────────────────────┐
│                                                      │
│  我的 AI 工具                                         │
│  让 OrangeBench agent 直接操作你的其他软件              │
│                                                      │
│  ── 已安装 (2) ──                                    │
│  ● 飞书云文档  — 读 / 写                  [...]      │
│    上次使用: 2 小时前 · 本月调用 47 次                │
│                                                      │
│  ● My Notion  — 读 / 写                   [...]      │
│    上次使用: 昨天                                    │
│                                                      │
│  ── 可安装 ──                                        │
│  ○ Google Drive                          [+ 安装]    │
│  ○ Google Sheets                         [+ 安装]    │
│  ○ Gmail                                 [+ 安装]    │
│  ○ Airtable                              [+ 安装]    │
│  ○ 企业微信                              [+ 安装]    │
│  ○ 飞书多维表格                          [+ 安装]    │
│                                                      │
│  ── 高级 ──                                          │
│  ○ 自定义 MCP Server  ⚠️  仅推荐给开发者    [+ 添加]  │
└──────────────────────────────────────────────────────┘
```

Each install goes through:
1. OAuth or API key entry
2. Scope review ("This will let OrangeBench read and write your Notion pages. [Approve] [Cancel]")
3. Test call ("Trying to read your first page... ✓ Got 'Welcome to Notion'")
4. Done → shows up in the agent's available tools

During agent conversations, tools are used transparently:

```
你: 把我昨天在 Notion 里写的产品方案拿过来整理一下

Agent: 让我找一下...

  🔍 调用 Notion · search("产品方案")
  ✓ 找到 3 篇,最近修改的是 "OB 产品方案 v2"  2h ago
  📄 调用 Notion · get_page("OB 产品方案 v2")
  ✓ 拿到 2,847 字

好,我读完了你的方案。核心是...
```

### Security considerations (not optional)

These must be designed in from day one:

1. **Encryption at rest** — configEncrypted uses a project KMS key, not the DB encryption key. Compromise of one user's data must not expose all users.
2. **Audit log** — every MCP tool call is logged with userId, server, tool name, timestamp. Users can see their own log at `/account/ai-tools/audit`.
3. **Approval workflow** — any destructive tool call (delete, send email, make payment) requires inline confirmation in the agent conversation, not just the original install consent.
4. **Rate limits** — default 100 tool calls per user per day, configurable up with billing.
5. **Provider approval** — catalog MCPs are vetted by OrangeBench. "Custom MCP" has big red warnings and tracks a permanent audit trail.
6. **Revocation** — user can instantly disable any MCP and kill in-flight workers that were using it.

### Success criteria

- **Month 1**: 5 catalog MCPs live, OAuth flow tested end-to-end
- **Month 2**: 10 catalog MCPs, 20+ installed instances across users
- **Month 3**: Custom MCP feature for power users, full audit log UI
- **Month 6**: MCP is the primary way agents accomplish real work (tool call count > pure text generation count)

## How the four integrations compose

These aren't independent features. They compose into a layered capability stack:

```
┌────────────────────────────────────────────────────────────┐
│                       user chats with AGENT                │
└───────────────────────────────┬────────────────────────────┘
                                │
                  ┌─────────────▼─────────────┐
                  │   1. Skill Role (persona) │  ← agency-agents-zh
                  │   "@品牌守护者 "          │     (3-5 days)
                  └─────────────┬─────────────┘
                                │
                  ┌─────────────▼─────────────┐
                  │   2. LLM + tool dispatch  │  ← existing + gstack
                  │                           │     (1 week)
                  └──┬──────────────┬─────────┘
                     │              │
           ┌─────────▼────┐  ┌──────▼────────┐
           │ gstack tools │  │ MCP servers   │  ← gstack + MCP
           │ browse/design│  │ Notion/Drive/.│     (1w + 3w)
           └─────────┬────┘  └──────┬────────┘
                     │              │
                     └──────┬───────┘
                            │
             ┌──────────────▼──────────────┐
             │  3. Output to user or       │
             │     → Zapier (other apps)   │  ← Zapier
             └─────────────────────────────┘     (2 weeks)
```

Layer 1 shapes **how** the agent thinks (the persona).
Layer 2 shapes **what** the agent can reach (the tools).
Layer 3 shapes **where** the output goes (the destinations).

All three layers are new. All three are shippable independently. The order maximizes shipping velocity: layer 1 requires no runtime changes, layer 2 requires a tool dispatcher, layer 3 requires an outbound webhook system, layer 2b (MCP) requires a full credential + sandbox system.

## Schema delta summary

The complete set of new tables + column additions across all 4 integrations:

### New tables (all 4 integrations)

| Integration | Table | Rows est. | Purpose |
|-------------|-------|-----------|---------|
| 1 | *(none — static assets)* | — | — |
| 2 | *(none — uses existing TaskEvent)* | — | — |
| 3 | `WebhookEndpoint` | 5-20 per user | Zapier endpoints config |
| 3 | `WebhookLog` | 100s per user per month | Audit trail for outbound webhooks |
| 4 | `McpServer` | 2-10 per user | User's installed MCP servers |
| 4 | `McpUsageLog` | 100s per user per day | MCP tool call audit trail |
| 4 | `McpPermission` | 1 per MCP per user | Granted scopes + expiry |

### Column additions (existing tables)

| Integration | Table | New column | Type | Purpose |
|-------------|-------|------------|------|---------|
| 1 | `Conversation` | `skillRoleId` | `String?` | Active AI colleague persona |
| 1 | `WorkspaceTask` | `preferredSkillRoles` | `String?` (JSON) | Suggested roles for this task |
| 2 | `TaskEvent` | `toolName` | `String?` | Which tool was called |
| 2 | `TaskEvent` | `toolInput` | `String?` | JSON |
| 2 | `TaskEvent` | `toolOutput` | `String?` | Result/file path |

### Migration strategy

Each column addition is a `prisma db push` that's safe (all nullable). New tables are fresh migrations. No data transformations required. Full rollback path: drop the new columns + tables, application falls back to pre-integration behavior automatically because each feature is gated behind a null check.

## Phased rollout plan

### Phase 1: Skill Role Picker (Days 1-7)

- Day 1-2: port `agency-agents-zh/` into `src/skills/agency-agents/` (move, add gitignore exclusion removal, add loader)
- Day 3: skill registry + search + loader unit tests
- Day 4-5: UI picker in `/agent` composer
- Day 6: integration with workspace task (preferred roles)
- Day 7: analytics event ("skill_role_selected"), internal testing

**Ships**: user can pick an AI colleague from 191 options, see role-shaped output.

### Phase 2: Design binary (Days 8-14)

- Day 8-9: vendor `design` binary into `bin/design` at repo root, add to Dockerfile / deploy script
- Day 10-11: `src/services/tools/design.ts` wrapper, intent routing in dispatcher
- Day 12: result card UI in agent conversation
- Day 13: per-user daily cap + credit cost per generation
- Day 14: internal testing with 10 representative briefs

**Ships**: agent generates images inline on demand, for any user.

### Phase 3: Zapier outbound webhooks (Days 15-28)

- Days 15-17: schema migration (WebhookEndpoint, WebhookLog), API CRUD
- Days 18-20: dispatcher + retry logic + failure handling
- Days 21-24: UI at `/account/integrations` — add/edit/test/delete endpoints
- Days 25-27: 10 Zapier template wizards, each with copy/paste flow
- Day 28: dogfood across 3 real workflows (Slack, Notion, Google Sheets)

**Ships**: users connect OB to any of Zapier's 5000+ apps via curated templates.

### Phase 4: gstack browse binary (Days 29-40)

- Days 29-31: whitelist design (10 Chinese platforms + selector registry)
- Days 32-34: per-user credential vault (encrypted at rest, KMS integration)
- Days 35-37: `src/services/tools/browse.ts` + dispatcher integration
- Days 38-39: per-user daily call cap + cost billing
- Day 40: internal testing with 5 real sites

**Ships**: agent can actually browse on behalf of user for whitelisted sites.

### Phase 5: MCP for end users (Days 41-80)

- Days 41-44: MCP client runtime (stdio/sse/http transports)
- Days 45-48: credential vault extension for MCP configs
- Days 49-52: worker lifecycle management (spawn, reuse, kill, cleanup)
- Days 53-60: catalog UI + 5 P0 MCPs (Notion, Drive, Sheets, Gmail, 飞书)
- Days 61-68: install wizards + OAuth flows for each P0 MCP
- Days 69-76: audit log UI + rate limiting + destructive action confirmation
- Days 77-80: full dogfood + security review

**Ships**: users install personal MCP tools, agent uses them transparently in tasks.

### Total timeline

- **Month 1** (Days 1-28): Phase 1-3 ship — OrangeBench becomes "agent with personas + visual output + Zapier"
- **Month 2** (Days 29-56): Phase 4 ships + Phase 5 starts — browse tool + MCP runtime live
- **Month 3** (Days 57-80): Phase 5 ships fully — MCP catalog complete

Each phase is independently shippable and demo-able. Nothing is held hostage by a later phase.

## Non-goals and explicit cuts

Things this plan deliberately does NOT do:

1. **Build a SKILLS abstraction layer from scratch** — agency-agents gives us a shortcut, we use it. The "real" SKILLS layer (with dynamic loading, marketplace, etc.) is Phase 6+ territory.
2. **Let users write their own AI colleagues** — roles are curated from the agency-agents library. User-contributed personas is a community feature for later.
3. **Ship OB as a Zapier published app** — webhook URL pasting is good enough for MVP. Publishing to Zapier's directory is a sales-driven effort, not a product-driven one.
4. **Support arbitrary MCP servers on day 1** — catalog only. "Custom MCP" comes after we know what real user patterns look like.
5. **Build a skill marketplace** — no ratings, no reviews, no pricing. Just a list.
6. **Replace the existing dispatch pipeline** — tool calls and skill roles are additive. The old text/image/plan paths still work unchanged.
7. **Build visible billing for skill roles** — using a role costs the same as a normal task. Differential pricing per role is a later optimization.

## Open questions (need answers before Phase 2 starts)

1. **Does the worker process have permission to execute arbitrary binaries?** — check the production deployment environment. If Fly/Vercel/etc restrict binary execution, we need a dedicated worker container.
2. **What's the credential vault strategy?** — libsodium + per-user key derivation? KMS? Currently nothing encrypted at rest beyond bcrypt'd passwords. This must be decided before browse tool ships.
3. **What's the cost ceiling per user per day?** — need a number before Phase 2. Current credit system is per-task but doesn't account for tool call cost explosion.
4. **Who reviews Zap templates before they go live?** — if it's just the founder, that's fine. If we want community-contributed templates, we need a review process.
5. **Which LLM provider supports MCP tool-calling best today?** — OpenRouter routes to many models; not all support tool use equally. Need a benchmark before Phase 5.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Skill role prompts eat context budget | Medium | Medium | Truncate roles to 300 tokens, load via `system` role |
| Browse binary breaks on a site update (e.g., Taobao redesigns) | High | High | Whitelist + selector registry versioned; graceful degradation to "I couldn't read the page, try again later" |
| Zapier drops webhook support | Very Low | High | Webhook is a stable primitive across Zapier lifetime; low actual risk |
| MCP ecosystem fragmentation (servers with different quality levels) | High | Medium | Curate a catalog, gate custom MCP behind a "power user" flag |
| User pastes a malicious Zapier URL that exfiltrates task data | Low | Critical | Show the target host in UI, warn on non-HTTPS, rate-limit failures |
| OAuth token leakage via logs or error messages | Medium | Critical | Structured logging with field redaction, PII filter on all error paths |
| Per-user credential encryption key management | High | Critical | Required design review before any Phase 4 or Phase 5 code ships |

## What happens on Day 0

Concrete next steps that can start immediately without approving the whole plan:

1. **Move `agency-agents-zh/` into `src/skills/agency-agents/`** and add it to the TypeScript build. This unblocks Phase 1 parsing work. ~30 minutes.
2. **Audit agency-agents coverage** — grep the 191 agent files for department, role, and tool requirements. Produce a 1-page "role coverage report" matching OrangeBench's top 10 ICP pain points. ~1 hour.
3. **Pick the first 20 "starter roles"** to feature in the Phase 1 picker UI. Not all 191 should show up on day one. ~30 minutes.
4. **Sketch the picker UX in Figma or a text mockup** and show 3 users. ~1 hour.
5. **Register an OrangeBench account on Zapier** and create a throwaway Zap using "Webhooks by Zapier" as the trigger. Verify the webhook URL format and payload contract. ~30 minutes.

Total: a half-day of work to validate the plan assumptions. If any of these blow up, the plan needs revision before Phase 1 starts.

---

**This is a planning document. No code has been written. Development starts on branch `claude/url-driven-ui-sWSBQ` after this plan is approved.**
