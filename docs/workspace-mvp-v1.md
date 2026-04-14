# ORANGEBENCH Workspace / Team Task Flow MVP v1.0

> **Version**: v1.0 FROZEN
> **Branch**: `claude/url-driven-ui-sWSBQ`
> **Date**: 2026-04-03
> **Status**: Frozen — ready for development
> **Approver**: Product Owner

---

## 0. Document Status

This document is the **sole development reference** for Workspace MVP. All implementation must follow this spec. Changes require explicit product approval and a new version number.

---

## 1. Role Definitions

Two roles for MVP. One user can hold different roles across workspaces.

| Role | ID | Responsibility | Permissions |
|------|----|----------------|-------------|
| **Owner (老板)** | `owner` | Publish tasks, assign, review, approve | Full workspace control: create, invite, assign, approve/reject, view all |
| **Member (员工)** | `member` | Receive assignments, execute with AI, submit | View assigned tasks, execute, submit, use Agent within task scope |

**MVP simplifications**:
- Reviewer role deferred — owner reviews directly
- One workspace per user (no multi-workspace switching)
- Owner can also self-assign tasks (solo mode, backward compatible)

---

## 2. Task Business State Machine

Business states layered on top of existing Agent technical states.

```
  draft ──> published ──> assigned ──> in_progress ──> submitted
                                          ^                |
                                          |           in_review
                                          |             /    \
                                       revision    approved
                                                       |
                                                   completed
```

| State | Triggered By | Next States | Notification |
|-------|-------------|-------------|--------------|
| `draft` | Owner creates task | published | — |
| `published` | Owner publishes | assigned | — |
| `assigned` | Owner assigns to member | in_progress | WeCom: 新任务分配 |
| `in_progress` | Member starts working | submitted | — |
| `submitted` | Member submits deliverable | in_review | WeCom: 待审核 |
| `in_review` | Owner opens review | revision, approved | — |
| `revision` | Owner requests changes | in_progress | WeCom: 驳回修改 |
| `approved` | Owner approves | completed | — |
| `completed` | Owner confirms completion | (terminal) | WeCom: 任务完成 |

**Relationship to Agent technical states**:

```
Business: in_progress
  |-- Agent task 1: completed (first draft)
  |-- Agent task 2: completed (revision)
  |-- Agent task 3: executing (still running)
  |
  Member clicks "提交交付物" → Business: submitted
```

Agent completion does NOT equal business completion. Only the owner's explicit approval closes a task.

---

## 3. Core Data Structures

### 3.1 New Tables

#### Workspace

```
Workspace
├── id              cuid, PK
├── name            string, required
├── ownerId         FK → User
├── createdAt       datetime
└── updatedAt       datetime
```

#### WorkspaceMember

```
WorkspaceMember
├── id              cuid, PK
├── workspaceId     FK → Workspace
├── userId          FK → User
├── role            'owner' | 'member'
├── invitedAt       datetime
├── joinedAt        datetime?
└── status          'active' | 'invited' | 'removed'

INDEX: [workspaceId, userId] UNIQUE
INDEX: [userId]
```

#### WorkspaceInvite

```
WorkspaceInvite
├── id              cuid, PK
├── workspaceId     FK → Workspace
├── email           string, required
├── role            'member' (MVP: always member)
├── invitedBy       FK → User (the owner who sent invite)
├── token           string, UNIQUE (URL-safe random, 32 chars)
├── status          'pending' | 'accepted' | 'expired' | 'revoked'
├── expiresAt       datetime (default: 7 days from creation)
├── acceptedUserId  FK → User? (set when accepted)
├── createdAt       datetime
└── updatedAt       datetime

INDEX: [token] UNIQUE
INDEX: [workspaceId, email]
INDEX: [email, status]
```

#### WorkspaceTask

```
WorkspaceTask
├── id              cuid, PK
├── workspaceId     FK → Workspace
├── title           string, required
├── description     text?
├── businessStatus  'draft' | 'published' | 'assigned' | 'in_progress' |
│                   'submitted' | 'in_review' | 'revision' |
│                   'approved' | 'completed'
├── priority        int (0=normal, 1=medium, 2=high, 3=urgent)
├── createdBy       FK → User
├── assigneeId      FK → User?
├── dueAt           datetime?
├── feedback        text? (revision notes from owner)
├── createdAt       datetime
└── updatedAt       datetime

INDEX: [workspaceId, businessStatus]
INDEX: [assigneeId, businessStatus]
INDEX: [createdBy]
```

#### WorkspaceTaskLink

```
WorkspaceTaskLink
├── id              cuid, PK
├── workspaceTaskId FK → WorkspaceTask
├── agentTaskId     FK → Task (existing agent task)
├── purpose         'draft' | 'revision' | 'final'
├── submittedAt     datetime?
└── createdAt       datetime

INDEX: [workspaceTaskId]
INDEX: [agentTaskId]
```

### 3.2 Existing Tables — Changes

```
Task (existing)
├── + workspaceTaskId  FK → WorkspaceTask?, nullable
└── (all existing fields preserved, null = personal task)

Conversation (existing)
├── + workspaceId      FK → Workspace?, nullable
└── (null = personal conversation, backward compatible)
```

No changes to User table schema. Workspace membership via WorkspaceMember join.

---

## 4. Invite Mechanism

### 4.1 Principle

**Email invite = registration entry + team join entry.**

The invite email serves dual purpose:
- For existing users: notification to join workspace
- For new users: onboarding funnel (register → auto-join)

### 4.2 Invite Flow

```
Owner clicks "邀请成员"
  |
  v
Enter email → POST /api/workspace/invite
  |
  v
System creates WorkspaceInvite (status: pending, token: random)
  |
  v
Send email via Resend/SMTP:
  Subject: "XXX 邀请你加入 ORANGEBENCH 工作区"
  Body: workspace name + invite link + 7-day expiry
  Link: https://domain.com/invite/{token}
  |
  v
Recipient clicks link → /invite/[token]
```

### 4.3 Invite Accept Logic

```
GET /invite/[token]
  |
  ├── Token invalid/expired/revoked → Show error page
  |
  ├── Token valid + User logged in + Already registered
  |     → Accept invite immediately
  |     → Create WorkspaceMember (status: active)
  |     → Update WorkspaceInvite (status: accepted, acceptedUserId)
  |     → Redirect to /workspace
  |
  ├── Token valid + User not logged in + Email matches existing user
  |     → Show: "请先登录"
  |     → Store token in sessionStorage
  |     → Redirect to /login?redirect=/invite/{token}
  |     → After login → auto-accept → redirect to /workspace
  |
  └── Token valid + Email not registered
        → Show: "欢迎加入，请先注册"
        → Redirect to /login?redirect=/invite/{token}&email={invite.email}
        → After registration → auto-accept → redirect to /workspace
```

### 4.4 Invite Constraints

- One active invite per email per workspace
- Resend allowed if previous invite expired
- Owner can revoke pending invites
- Expired invites (>7 days) auto-marked by query filter
- No invite approval flow — accept is immediate

---

## 5. Enterprise WeChat (WeCom) Notifications

### 5.1 Scope

**Notification only. No invite, no org sync, no login.**

WeCom is a one-way push channel for task lifecycle events.

### 5.2 Notification Events

| Event | Trigger | Message Template |
|-------|---------|-----------------|
| 新任务分配 | Owner assigns task | `[工作区] XXX 给你分配了新任务：{title}` |
| 待审核通知 | Member submits | `[工作区] {member} 提交了任务：{title}，请审核` |
| 驳回修改 | Owner requests revision | `[工作区] 任务「{title}」需要修改：{feedback preview}` |
| 任务完成 | Owner approves/completes | `[工作区] 任务「{title}」已完成` |

### 5.3 Technical Approach

- Use WeCom Bot Webhook (Group Robot)
- Single webhook URL per workspace (configured in workspace settings)
- POST JSON to webhook URL — no OAuth, no user mapping
- Fallback: if webhook not configured, skip silently
- Environment variable: none required (per-workspace config in DB)

### 5.4 Data Structure

Add to Workspace table:

```
Workspace
├── + wecomWebhookUrl   string? (WeCom Bot webhook URL)
```

### 5.5 NOT in MVP

- WeCom user identity mapping
- WeCom login/SSO
- WeCom org structure import
- WeCom invite flow
- Per-user notification preferences for WeCom

---

## 6. Pages & Routes

### 6.1 New Routes

| Route | Purpose | Auth | Template |
|-------|---------|------|----------|
| `/workspace` | Task board — list by status | Login + workspace member | Dashboard (1100px) |
| `/workspace/tasks/new` | Create & assign task | Login + workspace owner | Form card |
| `/workspace/tasks/[id]` | Task detail + history + actions | Login + workspace member | Detail layout |
| `/workspace/members` | Member list + invite | Login + workspace owner | Settings (1100px) |
| `/workspace/settings` | Workspace name, WeCom config | Login + workspace owner | Settings (1100px) |
| `/invite/[token]` | Invite accept landing | Public (handles auth internally) | Centered card |

### 6.2 Existing Route Changes

| Route | Change |
|-------|--------|
| `/agent` sidebar | Add "工作区任务" section above personal conversations |
| `/agent` | When opened from workspace task, show context banner |
| `/tasks` | Add filter tab: "个人" / "团队" |
| `/dashboard` | Add workspace summary row if user has workspace |
| Top nav | Add "工作区" entry between "处理" and "设置" |

### 6.3 Navigation Update

```
AGENT / 任务 / 总览 / 处理 / 工作区 / 设置 / 账户
```

### 6.4 Invite Page Logic (`/invite/[token]`)

Single page with 3 states:

**State A — Error**:
- Token invalid, expired, or revoked
- Show: icon + "邀请链接已失效" + "请联系管理员重新发送邀请" + [返回首页]

**State B — Accept** (logged in):
- Show: workspace name + "你已被邀请加入" + [接受邀请]
- Click → POST accept → redirect /workspace

**State C — Need Auth** (not logged in):
- Show: workspace name + "请先登录或注册" + [去登录]
- Login redirect preserves invite token

---

## 7. Agent Context Integration

### 7.1 Member Uses Agent Within Business Task

```
1. Member opens WorkspaceTask detail (/workspace/tasks/[id])
2. Clicks "用 Agent 执行"
3. System:
   a. Creates Conversation (workspaceId set)
   b. Creates Agent Task (workspaceTaskId set)
   c. Passes context to Agent:
      - task title, description, priority, dueAt
      - feedback (if revision)
      - previous Agent outputs (if any)
   d. Redirects to /agent?conversationId=xxx
4. Agent executes as usual (SSE, worker, tools)
5. Member can run multiple Agent tasks
6. Returns to /workspace/tasks/[id]
7. Clicks "提交交付物"
8. Selects which Agent output(s) to submit
9. businessStatus → submitted
10. Owner notified (in-app + WeCom)
```

### 7.2 Context Payload

When Agent task created from workspace task:

```typescript
const contextPayload = {
  workspaceTaskId: workspaceTask.id,
  workspaceTaskTitle: workspaceTask.title,
  workspaceTaskDescription: workspaceTask.description,
  priority: workspaceTask.priority,
  dueAt: workspaceTask.dueAt,
  feedback: workspaceTask.feedback,  // if revision
  previousOutputs: linkedTasks.map(t => t.result),  // prior attempts
};
```

Injected into Agent system prompt via existing `context` field on Task.

### 7.3 Review → Revision Loop

```
Owner rejects → businessStatus = 'revision'
             → feedback stored
Member re-opens → sees feedback banner
              → clicks "用 Agent 修改"
              → Agent gets: original task + feedback + prior output
              → New Agent task created (purpose: 'revision')
              → Member submits again
```

---

## 8. MVP Scope — Final

### 8.1 IN MVP

| Feature | Detail |
|---------|--------|
| Workspace CRUD | Create, name, basic settings |
| Email invite | Send, accept, auto-join for new/existing users |
| Invite landing page | /invite/[token] with 3 states |
| 2 roles: owner + member | No reviewer role |
| Task CRUD | Create, publish, assign |
| Business state machine | 9 states as defined |
| Agent execution within task | "用 Agent 执行" button |
| Submit deliverable | Member submits for review |
| Owner approve / revision | 2 actions |
| Task board view | List grouped by status |
| WeCom notification | 4 event types via webhook |
| In-app notification | Toast + unread badge |
| Workspace nav entry | Top nav + Agent sidebar section |

### 8.2 NOT IN MVP

| Feature | Reason |
|---------|--------|
| Reviewer independent role | Owner reviews directly |
| WeCom invite / org import | WeCom = notification only |
| WeCom login / SSO | Separate auth track |
| Multiple workspaces per user | One workspace for MVP |
| Due date enforcement / auto-reminders | Nice-to-have |
| Task templates | Later iteration |
| Activity timeline / audit log | Later |
| Workspace-level billing (team credits) | Use individual billing |
| Complex permission matrix | Owner = full, member = assigned only |
| Guest / external collaborator | Later |
| Kanban drag-and-drop | List view sufficient |
| Real-time collaboration | Not needed for v1 |
| Task comments / discussion thread | Later |
| Invite approval flow | Accept is immediate |
| Bulk invite / CSV import | Manual email invite only |

---

## 9. Gap Analysis: Current System → Target

| # | Gap | Current | Target | Size |
|---|-----|---------|--------|------|
| 1 | No Workspace model | Single-user | Multi-user workspace | L |
| 2 | No business states | Technical states only | 9 business states | M |
| 3 | No assignment | Creator = executor | Owner → member assignment | M |
| 4 | No review flow | AI done = done | Submit → review → approve | M |
| 5 | No invite system | Manual registration | Email invite + auto-join | M |
| 6 | No invite page | — | /invite/[token] with 3 states | S |
| 7 | No WeCom push | — | Webhook notifications (4 events) | S |
| 8 | No workspace conversations | All personal | workspaceId on Conversation | S |
| 9 | No task→Agent bridge | Agent tasks standalone | WorkspaceTaskLink + context | M |
| 10 | No workspace nav | Personal nav only | Sidebar section + top nav item | S |
| 11 | No in-app notifications | — | Toast + badge for assignments/reviews | M |

S = 1-2 days, M = 3-5 days, L = 5-10 days

---

## 10. Development Order

### Phase 1: Foundation (Week 1)

| # | Task | Owner | Depends On |
|---|------|-------|-----------|
| 1.1 | Prisma schema: Workspace, WorkspaceMember, WorkspaceInvite, WorkspaceTask, WorkspaceTaskLink | Backend | — |
| 1.2 | Prisma migration + seed data | Backend | 1.1 |
| 1.3 | Add workspaceId to Conversation, workspaceTaskId to Task | Backend | 1.1 |
| 1.4 | API: workspace CRUD | Backend | 1.2 |
| 1.5 | API: invite create + accept + revoke | Backend | 1.2 |
| 1.6 | API: workspace task CRUD + state transitions | Backend | 1.2 |
| 1.7 | Invite email template (Resend) | Backend | 1.5 |

### Phase 2: Pages (Week 2)

| # | Task | Owner | Depends On |
|---|------|-------|-----------|
| 2.1 | `/invite/[token]` — invite accept page | Frontend | 1.5 |
| 2.2 | `/workspace` — task board (list by status) | Frontend | 1.6 |
| 2.3 | `/workspace/tasks/new` — create + assign | Frontend | 1.6 |
| 2.4 | `/workspace/tasks/[id]` — detail + actions | Frontend | 1.6 |
| 2.5 | `/workspace/members` — list + invite form | Frontend | 1.4, 1.5 |
| 2.6 | `/workspace/settings` — name + WeCom webhook | Frontend | 1.4 |
| 2.7 | Top nav + sidebar workspace section | Frontend | 2.2 |

### Phase 3: Agent Integration + Notifications (Week 3)

| # | Task | Owner | Depends On |
|---|------|-------|-----------|
| 3.1 | "用 Agent 执行" — create linked Agent task | Full-stack | 2.4, 1.3 |
| 3.2 | Context passing: workspace task → Agent prompt | Backend | 3.1 |
| 3.3 | Submit deliverable flow | Full-stack | 2.4 |
| 3.4 | Owner review/approve/revision flow | Full-stack | 2.4 |
| 3.5 | WeCom webhook notification service | Backend | 1.4 |
| 3.6 | Send WeCom on 4 events (assign/submit/revise/complete) | Backend | 3.5 |
| 3.7 | In-app notification (toast + badge count) | Frontend | 3.3, 3.4 |

### Phase 4: Polish (Week 4)

| # | Task | Owner | Depends On |
|---|------|-------|-----------|
| 4.1 | `/tasks` — add "个人/团队" filter tab | Frontend | 1.3 |
| 4.2 | `/dashboard` — workspace summary row | Frontend | 1.6 |
| 4.3 | Revision loop: feedback → re-execute with context | Full-stack | 3.4 |
| 4.4 | Empty states, loading, error handling | Frontend | All |
| 4.5 | Update UI spec doc with workspace components | Docs | All |

### Critical Path

```
Schema (1.1) → Migration (1.2) → Task API (1.6) → Task Board (2.2)
  → Detail Page (2.4) → Agent Button (3.1) → Submit (3.3) → Review (3.4)
```

**Demo milestone (end Week 2)**: Owner creates workspace → invites member → creates and assigns task → member sees task board.

**Full MVP milestone (end Week 3)**: Complete loop — owner publishes → member uses Agent → submits → owner approves → WeCom notifies.

---

## Appendix A: API Endpoint Plan

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/workspace` | Create workspace |
| GET | `/api/workspace` | Get user's workspace |
| PATCH | `/api/workspace` | Update workspace settings |
| POST | `/api/workspace/invite` | Send invite |
| GET | `/api/workspace/invite/[token]` | Validate invite token |
| POST | `/api/workspace/invite/[token]/accept` | Accept invite |
| DELETE | `/api/workspace/invite/[id]` | Revoke invite |
| GET | `/api/workspace/members` | List members |
| DELETE | `/api/workspace/members/[id]` | Remove member |
| GET | `/api/workspace/tasks` | List workspace tasks |
| POST | `/api/workspace/tasks` | Create workspace task |
| GET | `/api/workspace/tasks/[id]` | Get task detail |
| PATCH | `/api/workspace/tasks/[id]` | Update task (assign, status transition) |
| POST | `/api/workspace/tasks/[id]/submit` | Member submits deliverable |
| POST | `/api/workspace/tasks/[id]/review` | Owner approves or requests revision |
| POST | `/api/workspace/tasks/[id]/agent` | Create linked Agent task |

## Appendix B: WeCom Message Templates

```
// 新任务分配
{
  "msgtype": "markdown",
  "markdown": {
    "content": "## 新任务分配\n**{owner}** 给你分配了新任务\n> {title}\n[查看任务](https://domain/workspace/tasks/{id})"
  }
}

// 待审核
{
  "msgtype": "markdown",
  "markdown": {
    "content": "## 待审核\n**{member}** 提交了任务交付物\n> {title}\n[去审核](https://domain/workspace/tasks/{id})"
  }
}

// 驳回修改
{
  "msgtype": "markdown",
  "markdown": {
    "content": "## 需要修改\n任务「{title}」被退回\n> {feedback_preview}\n[查看详情](https://domain/workspace/tasks/{id})"
  }
}

// 任务完成
{
  "msgtype": "markdown",
  "markdown": {
    "content": "## 任务完成\n任务「{title}」已通过审核并完成\n[查看结果](https://domain/workspace/tasks/{id})"
  }
}
```

---

*End of frozen spec. Development starts on branch `claude/url-driven-ui-sWSBQ`.*
