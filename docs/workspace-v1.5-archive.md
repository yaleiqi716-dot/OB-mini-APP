# ORANGEBENCH Workspace / Team Flow v1.5 收官归档

> **Status**: ARCHIVED — Stable Release
> **Branch**: `claude/url-driven-ui-sWSBQ`
> **Commit**: `f445e31ec271cf97c93a6a3466535cce37726b33`
> **Version**: Workspace / Team Flow v1.5 Stable
> **Date**: 2026-04-04

---

## 1. Version Definition

| Field | Value |
|-------|-------|
| Branch | `claude/url-driven-ui-sWSBQ` |
| Stable commit | `f445e31` |
| Version name | **ORANGEBENCH Workspace / Team Flow v1.5 Stable** |
| Predecessor | Workspace MVP v1.0 (`9f0e3f8`) |
| Total commits in this branch | 30+ (from initial URL-driven UI through v1.5) |

This version represents the first complete, deployment-tested workspace collaboration system with AI-assisted task execution.

---

## 2. Completed Capabilities

### Workspace Core Loop

| Capability | Status |
|-----------|--------|
| Workspace create (dedicated form page) | Shipped |
| 6-state business machine (draft → assigned → in_progress → submitted → revision → completed) | Shipped |
| Task create with title, description, priority, due date, assignee | Shipped |
| Task assign to workspace member | Shipped |
| Member submit deliverable (with summary + attachments) | Shipped |
| Owner approve → completed | Shipped |
| Owner reject → revision (with feedback) | Shipped |
| Revision loop (reject → re-execute → re-submit) | Shipped |

### Invite & Onboarding

| Capability | Status |
|-----------|--------|
| Email invite (Resend + SMTP fallback) | Shipped |
| /invite/[token] landing page (3 states) | Shipped |
| Registered user: login → auto-join | Shipped |
| New user: register → auto-join | Shipped |
| /login redirect support (?redirect= + ?email=) | Shipped |
| Invite list, revoke (by token) | Shipped |
| Member management page | Shipped |

### Agent Integration

| Capability | Status |
|-----------|--------|
| "Use Agent" button on task detail | Shipped |
| Workspace task context injection into Agent prompt | Shipped |
| Auto-create Conversation (with workspaceId) | Shipped |
| Auto-create Task (with workspaceTaskId) | Shipped |
| WorkspaceTaskLink (agentTaskId + conversationId + purpose) | Shipped |
| Execution history display with conversation links | Shipped |
| Revision context: feedback + prior output passed to Agent | Shipped |

### Main Site Fusion

| Capability | Status |
|-----------|--------|
| /tasks personal/team tab switch | Shipped |
| /dashboard workspace summary card | Shipped |
| /review personal/team tab switch | Shipped |
| Workspace in top nav (7 items across all pages) | Shipped |
| /agent sidebar workspace entry | Shipped |
| MAIN_NAV shared source (src/lib/nav.ts) | Shipped |

### Collaboration Enhancement

| Capability | Status |
|-----------|--------|
| Task attachments (create + submit, via /api/upload) | Shipped |
| FileUploader + AttachmentList shared components | Shipped |
| Task comments/discussion (text timeline) | Shipped |
| In-app notifications (Notification table + 3 APIs) | Shipped |
| Notification bell + dropdown (in AppHeader, all pages) | Shipped |
| 6 notification event types (assign/submit/revision/complete/comment/invite) | Shipped |
| WeCom webhook notifications (4 events) | Shipped |

### Billing Formalization

| Capability | Status |
|-----------|--------|
| /billing page redesigned (ORANGEBENCH spec) | Shipped |
| /account "订阅与充值" entry opened | Shipped |
| WeChat Pay full chain (order → QR → webhook → credits) | Shipped |
| Auth guard on billing page | Shipped |

### Infrastructure

| Capability | Status |
|-----------|--------|
| Shared auth middleware (withAuth/withWorkspaceMember/withWorkspaceOwner) | Shipped |
| Legacy cleanup (Team model removed, NavHeader deleted) | Shipped |
| Unified AppHeader (notification bell on all pages) | Shipped |
| Cookie dual-check (ob-session + ob-user-id) | Shipped |
| SSR safety (no document access at render time) | Shipped |
| Invite API route conflict resolved ([id] → [token]) | Shipped |

---

## 3. Recommended Demo Paths

### Path A: Owner Perspective

```
1. Login → /workspace (see empty state)
2. Click "创建工作区" → /workspace/new → enter name
3. /workspace/members → invite member via email
4. /workspace/tasks/new → create task, assign to member, set priority + due date, attach reference file
5. /workspace → see task in "待处理" group with assignee avatar
6. Wait for member to submit → see task move to "待审核"
7. Open task → read submission summary + attachments + comments
8. Approve or reject with feedback
9. Check notification bell for updates throughout
```

### Path B: Member Perspective

```
1. Receive invite email → click link → /invite/[token]
2. Login/register → auto-join workspace
3. /workspace → see assigned task in "待处理"
4. Open task → read description + reference attachments
5. Click "用 Agent 执行" → redirected to /agent with context
6. Agent executes (SSE streaming) → results rendered
7. Return to task detail → see execution history
8. Add comment: "已完成初稿，请查看"
9. Attach deliverable file → click "提交交付物"
10. If rejected → see feedback → re-execute with feedback context → resubmit
```

### Path C: Full Collaboration Loop

```
Owner: Create workspace → invite member → create task "写季度报告"
  → assign to member → attach requirements doc

Member: Receive notification (bell + WeCom) → open task
  → read requirements + attachment → use Agent to draft
  → comment "初稿已完成" → submit deliverable

Owner: Receive submit notification → open task
  → read submission + attachments → comment "需要加竞品分析"
  → reject with feedback

Member: Receive revision notification → see feedback banner
  → use Agent again (with feedback context) → revise → resubmit

Owner: Approve → task completed → member receives completion notification
```

---

## 4. Known Technical Debt

### P0 — None

No known blocking issues at this time.

### P1 — Affects experience

| Item | Impact |
|------|--------|
| Notification polling 30s interval | Delay in seeing new notifications; SSE would be better but complex |
| Attachments stored as JSON string in WorkspaceTask | Can't query by file; works for MVP volume |
| /api/upload stores to local filesystem | Files lost on server restart/migration; should migrate to OSS/S3 |
| chargeCredits in billing.ts is not atomic | User + Task updates are separate; charged flag mitigates |

### P2 — Code structure only

| Item | Impact |
|------|--------|
| Comment area doesn't auto-scroll to bottom | New comments may be out of view |
| billing-config.ts pricing hardcoded | Price changes require code deploy |
| AppHeader component in workspace/ directory | Should be in shared components; naming mismatch |
| Some workspace API handlers do additional permission checks beyond middleware | Could be further standardized |
| Task.teamId field still exists in schema (orphaned after Team removal) | No functional impact, just dead field |

---

## 5. Explicitly Not Built

| Capability | Reason |
|-----------|--------|
| Reviewer independent role | Owner reviews directly; covers 80% of cases |
| Multiple workspaces per user | One workspace sufficient for MVP validation |
| Team credit pool | Individual billing works; changing billing core is high-risk |
| Multi-level approval chain | Single-level approval covers mainstream scenarios |
| Notification center page | Dropdown panel sufficient for current volume |
| Attachment version management | Complexity outweighs value at current scale |
| Kanban drag-and-drop | List grouping is sufficient |
| Task templates | Manual creation fine at low task volume |
| Comment edit/delete | MVP doesn't need it |
| Comment rich text / @mention | Plain text timeline sufficient |
| Activity log / audit trail | Needed at 10+ team members, not now |
| Real-time collaboration (live cursors) | Not a co-editing product |
| WeCom invite / SSO / org import | WeCom is notification-only channel |

---

## 6. Suggested Observation Metrics

Track these during real usage to inform v2.0 decisions:

### Adoption Metrics

| Metric | What it tells you | Action threshold |
|--------|------------------|-----------------|
| Invite send → accept rate | Is onboarding friction too high? | < 50% → simplify invite flow |
| Workspace creation rate | Are users finding the feature? | < 10% of active users → improve discovery |
| Tasks created per workspace per week | Is the feature being used? | < 2/week → feature isn't sticky |

### Workflow Metrics

| Metric | What it tells you | Action threshold |
|--------|------------------|-----------------|
| Task create → complete conversion | Are tasks getting done? | < 40% → investigate blockers |
| Average time: assigned → submitted | How long do tasks take? | Baseline, no threshold |
| Revision rate (tasks rejected / tasks submitted) | Are requirements clear enough? | > 50% → need better task creation |
| Agent usage rate (tasks using Agent / total tasks) | Is AI integration valued? | < 30% → Agent context may be weak |

### Engagement Metrics

| Metric | What it tells you | Action threshold |
|--------|------------------|-----------------|
| Comments per task (average) | Is discussion happening? | < 0.5 → may need @mention or nudges |
| Attachment usage rate | Are files being shared? | Baseline |
| Notification click-through rate | Are notifications useful? | < 20% → notifications may be noisy |
| WeCom delivery success rate | Is the channel reliable? | < 90% → check webhook config |

### Revenue Metrics

| Metric | What it tells you | Action threshold |
|--------|------------------|-----------------|
| /billing page visits from workspace users | Does team usage drive payment? | Track correlation |
| Credits consumed by workspace tasks vs personal | Is team driving more usage? | If > 50% → consider team billing |

---

## 7. Next Phase Principles

### When to enter v2.0

Enter v2.0 development when **at least 2 of these signals** appear:

1. **3+ active workspaces** with 3+ members each, consistently creating tasks weekly
2. **User requests** for reviewer role, multi-workspace, or team billing appear repeatedly (3+ requests)
3. **Revision rate > 40%** suggesting need for better approval workflow
4. **Comment volume > 3 per task** suggesting need for richer discussion features
5. **Team credit consumption > individual** suggesting need for team billing model

### When to stay on v1.5

Stay on v1.5 stable iteration if:

- Workspace adoption is still growing (don't disrupt)
- No clear demand signal for v2.0 features
- Core bugs or UX issues still need fixing
- Payment/billing needs stabilization
- Team size is < 5 across all workspaces

### v1.5 stable iteration scope (allowed without entering v2.0)

- Bug fixes
- Visual polish (< 1 day per item)
- Performance optimizations
- Error message improvements
- Deployment fixes
- Documentation updates

### v2.0 scope trigger examples

These would require v2.0 planning:

- Reviewer independent role → new permission model
- Multi-workspace → workspace switcher + data isolation
- Team credit pool → billing architecture change
- Real-time notifications (SSE) → infrastructure change
- File storage migration (local → OSS) → infrastructure change

---

*This document is the final archive for Workspace / Team Flow v1.5. No further feature development on this version. All future work requires explicit planning and version increment.*
