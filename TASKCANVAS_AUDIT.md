# TaskCanvas Deep Audit — Rewrite Intelligence Report

**File**: `src/components/agent/TaskCanvas.tsx` — 1,112 lines
**Role**: Renders the AI response area for each task in a conversation thread.

---

## 1. Result Type Inventory

| # | Type ID | Trigger Condition | Lines | Dependencies | User Interactions |
|---|---------|-------------------|-------|--------------|-------------------|
| 1 | `ppt` | `result.type === 'ppt' && result.slides` | 903–920 | None (pure JSX) | Copy, export, follow-up actions |
| 2 | `email` | `result.type === 'email' && result.content` | 922–932 | None | Copy, export |
| 3 | `proposal` | `result.type === 'proposal'` | 934–949 | None | Copy, export |
| 4 | `agent_loop` | `result.type === 'agent_loop'` | 951–968 | None | Copy |
| 5 | `orchestrator` | `result.type === 'orchestrator' && result.plan` | 970–986 | None | View sub-tasks |
| 6 | `text` / undefined | `result.type === 'text'` or fallback with `.text` | 988–997 | None | Copy, export |
| 7 | `direct` | `result.type === 'direct' && result.content` | 998–1006 | None | Copy, export |
| 8 | `image` | `result.type === 'image'` or `imageUrl`/`image_url` | 1009–1032 | `<img>` tag | Open in new tab, download |
| 9 | `video` | `result.type === 'video'` or `videoUrl`/`video_url` | 1034–1056 | `<video>` tag | Play, download |
| 10 | Fallback | None of the above match | 1058–1068 | None | Copy |
| 11 | Preview (locked) | `result._preview === true` | 587–612 | Fetch `/api/tasks/:id/unlock` | Unlock (pay credits) |

**No external rendering libraries** (no markdown parser, no react-pdf, no video player lib). All rendering is plain JSX + HTML `<video>`.

---

## 2. Data Flow

### Input Props (lines 29–50)

```typescript
interface TaskCanvasProps {
  taskId: string;              // Task identifier
  title: string;               // Task title
  type: string;                // Task type (email/ppt/proposal/...)
  status: TaskStatus;          // pending|queued|understanding|structuring|interacting|executing|completed|failed
  input: string;               // User's original prompt
  events: TaskEvent[];         // All SSE + polled events for this task
  currentInteraction: Interaction | null;  // Active approval/interaction gate
  onInteractionSubmit: fn;     // Submit interaction response
  onApprove: fn;               // Approve approval gate
  onReject: fn;                // Reject approval gate
  onAdjustStructure: fn;       // Request structure adjustment
  onAdjustProposal: fn;       // Request proposal adjustment
  onReviseEmail: fn;           // Request email revision
  actionLoading: boolean;      // Approval button loading state
  result: Record | null;       // Final result data
  loading?: boolean;           // Initial loading skeleton
  credits?: number | null;     // User's remaining credits
  executionStrategy?: string;  // Not used in render (dead prop)
  modelName?: string;          // Not used in render (dead prop)
  onNewTask?: fn;              // Create follow-up task from result actions
}
```

### Internal State

| State | Type | Purpose |
|-------|------|---------|
| `copied` (ResultContainer) | boolean | Copy-to-clipboard feedback |
| `phaseIdx` (ExecutionTimeline) | number | Current fake progress phase |
| `completedPhases` (ExecutionTimeline) | number[] | Completed fake phases |

**Minimal internal state** — almost everything is derived from props. The component is largely a pure render function.

### SSE / Polling Data Path

TaskCanvas does NOT subscribe to SSE directly. The parent (`AgentPageInner`) manages both channels:

```
SSE /api/tasks/:id/events
  └─ onEvent callback updates tasks[] state
      └─ TaskCanvas receives new events/status/result via props

Polling (2s interval)
  └─ GET /api/tasks/:id
      └─ parseTaskFromAPI replaces task in tasks[] state
          └─ TaskCanvas receives updated props
```

### Why Both SSE and Polling?

- **SSE**: Real-time incremental events (thinking, step_update, interaction_request, task_completed). Low latency.
- **Polling**: Safety net. SSE can drop events on reconnect, miss events during the reconnection window, or fail silently in some network environments. Polling ensures the task eventually converges to the correct state by fetching the full snapshot.
- **Overlap risk**: Both update the same `tasks[]` state. Last write wins. If polling fetches stale data after SSE delivered a newer event, the UI can briefly regress.

### Race Condition Scenarios

1. **Submit → Fetch → SSE replay**: After POST /api/tasks, the page immediately fetches the task AND opens SSE. If SSE replays historical events before the fetch returns, the fetch response may overwrite SSE-delivered state with an older snapshot.

2. **Rapid task switching**: User clicks task A, SSE opens for A. User quickly clicks task B. The cleanup for A's SSE may fire after B's SSE starts. If the A cleanup writes to state after B is active, B's UI briefly shows A's data.

3. **Polling + SSE event for same status change**: Both deliver `status_change` to `completed`. The first triggers `fetchQuota()` + `showSuccess()`. The second triggers them again (duplicate toast, duplicate quota fetch).

---

## 3. Visual Layout

### Position in Page

```
┌─────────────────────────────────────────────┐
│ [Sidebar]  │  [Main Content Area]           │
│            │  ┌───────────────────────────┐  │
│            │  │ User bubble (orange)      │  │
│            │  └───────────────────────────┘  │
│            │  ┌───────────────────────────┐  │
│            │  │ ┌─ TaskCanvas ──────────┐ │  │
│            │  │ │ AI avatar + status    │ │  │
│            │  │ │ Mission phase bar     │ │  │
│            │  │ │ Thinking stream       │ │  │
│            │  │ │ Completed steps       │ │  │
│            │  │ │ Approval card         │ │  │
│            │  │ │ OR Result card        │ │  │
│            │  │ │ OR Error card         │ │  │
│            │  │ │ Action buttons        │ │  │
│            │  │ └───────────────────────┘ │  │
│            │  └───────────────────────────┘  │
│            │  [AgentInput - fixed bottom]    │
└─────────────────────────────────────────────┘
```

### Internal Sections (top to bottom, conditional)

1. **Loading skeleton** — shown when `loading` is true
2. **AI avatar row** — icon + "ORANGEBENCH" label + status badge
3. **Mission phase bar** — READY/SIGNAL/PLAN/RUNNING/WAIT indicator
4. **Visible logs** — only in result/error mode
5. **Completed structure** — confirmed outline pills
6. **Completed steps** — step blocks with dots
7. **Thinking stream** — italic Typewriter with left border
8. **Execution Timeline** — fake progress before real events
9. **Approval cards** — email/structure/proposal gates (mutually exclusive)
10. **Generic interaction** — question + choice buttons
11. **Result card** — type-dispatched result view (or locked preview)
12. **Error card** — bucketed error with retry
13. **Blocked card** — insufficient credits message

**No internal tabs or multi-region layout.** It's a single vertical flow — sections show/hide based on the `NarrativeMode`.

### Width Behavior

TaskCanvas fills its parent container (`.ob-msg-ai`). Max width is constrained by `.ob-messages` at `var(--chat-max)` = 780px. No internal responsive breakpoints — it's always the chat column width.

---

## 4. Proposed Component Decomposition

### Target: No file > 250 lines

```
src/components/product/task/
├── TaskCanvas.tsx          (~80 lines)  — Shell + mode dispatch
├── TaskStatusHeader.tsx    (~60 lines)  — Avatar, mission phase, status badge
├── TaskThinkingStream.tsx  (~40 lines)  — Typewriter with border
├── TaskStepList.tsx        (~50 lines)  — Completed steps container
├── TaskExecutionTimeline.tsx (~50 lines) — Fake progress phases
├── TaskApprovalGate.tsx    (~80 lines)  — ApprovalCard + email/structure variants
├── TaskInteraction.tsx     (~50 lines)  — Generic interaction (question + choices)
├── TaskResultRenderer.tsx  (~40 lines)  — Type dispatch switch
├── TaskResultContainer.tsx (~60 lines)  — Card wrapper + copy button
├── TaskErrorCard.tsx       (~80 lines)  — Bucketed errors + retry
├── results/
│   ├── TextResult.tsx      (~30 lines)
│   ├── EmailResult.tsx     (~40 lines)
│   ├── PPTResult.tsx       (~40 lines)
│   ├── ProposalResult.tsx  (~40 lines)
│   ├── ImageResult.tsx     (~40 lines)
│   ├── VideoResult.tsx     (~40 lines)
│   ├── AgentLoopResult.tsx (~30 lines)
│   ├── OrchestratorResult.tsx (~30 lines)
│   └── LockedPreview.tsx   (~40 lines)
└── utils/
    ├── humanize.ts         (~60 lines)  — humanizeThinking, humanizeStep, humanizeStatusBar
    ├── eventParsers.ts     (~60 lines)  — getProgress, getCompletedSteps, buildThinkingPhases
    └── constants.ts        (~30 lines)  — TYPE_LABELS, SUGGESTIONS, EXEC_PHASES, error buckets
```

**Total: ~1,000 lines across 22 files. Average: ~45 lines per file. Max: ~80 lines.**

---

## 5. SSE + Polling Solution

### Option A: SSE only, drop polling
- **Pro**: Simpler, no race conditions
- **Con**: SSE reconnection can miss events. If EventSource drops during a 15-second backoff, task state is stale until reconnect.
- **Verdict**: Too risky for production.

### Option B: Polling fallback, SSE optimistic (current approach)
- **Pro**: Resilient — polling catches any SSE gaps
- **Con**: Race conditions between the two channels. Duplicate side effects.
- **Verdict**: Works but needs dedup logic.

### Option C: React Query + SSE invalidation (recommended)
- Use `@tanstack/react-query` for task data with a 5s `refetchInterval` (replaces the 2s raw polling).
- SSE events call `queryClient.invalidateQueries(['task', taskId])` to trigger an immediate refetch.
- React Query handles dedup, caching, stale-while-revalidate, and retry automatically.
- SSE is purely a "nudge" — it tells React Query to refetch, never writes to state directly.
- **Pro**: Zero race conditions. Single source of truth. Built-in loading/error states.
- **Con**: New dependency. Slightly higher latency than direct SSE state writes (one extra fetch round-trip).
- **Verdict**: Best balance of reliability and simplicity. The extra round-trip is ~50ms on localhost, imperceptible.

**Recommendation: Option C.** The 2s polling is a smell — it exists because SSE alone isn't trusted. React Query formalizes this distrust into a clean pattern.

---

## 6. Risk Classification

### High Risk
| Item | Why |
|------|-----|
| SSE connection lifecycle | Reconnection, cleanup, stale closures via refs |
| State merge between SSE + polling | Last-write-wins can regress UI |
| Task status machine transitions | 8 states with conditional UI; wrong transition = broken UX |
| Approval gate timing | If SSE delivers interaction_request while user is mid-response to previous one |

### Medium Risk
| Item | Why |
|------|-----|
| ResultView type dispatch | 11 branches; missing a type = blank result |
| Error bucketing logic | 8 error codes + 3 special cases; wrong bucket = confusing message |
| Thinking stream append mode | Typewriter must detect "text grew" vs "text replaced" |
| ExecutionTimeline fake phases | Timer-based; must not conflict with real events |

### Low Risk
| Item | Why |
|------|-----|
| AI avatar row | Static markup |
| CompletedStructure | Pure render from data |
| StructureList | Pure render from data |
| ResultContainer + copy | Clipboard API, simple state |
| Mission phase bar | Status → label mapping |
| humanize* functions | Pure string transforms, unit-testable |

---

## 7. Recommended Rewrite Order

### Phase 1 — Extract utilities (zero UI risk)
1. `utils/humanize.ts` — pure functions, no dependencies
2. `utils/eventParsers.ts` — pure functions, no dependencies
3. `utils/constants.ts` — static data

### Phase 2 — Extract result renderers (isolated, testable)
4. `results/TextResult.tsx` — simplest result type
5. `results/EmailResult.tsx`
6. `results/PPTResult.tsx`
7. `results/ProposalResult.tsx`
8. `results/ImageResult.tsx`
9. `results/VideoResult.tsx`
10. `results/AgentLoopResult.tsx`
11. `results/OrchestratorResult.tsx`
12. `results/LockedPreview.tsx`
13. `TaskResultContainer.tsx` — shared card wrapper
14. `TaskResultRenderer.tsx` — type dispatch switch

### Phase 3 — Extract status/progress components
15. `TaskStatusHeader.tsx` — avatar + mission phase
16. `TaskStepList.tsx` — completed steps
17. `TaskThinkingStream.tsx` — Typewriter wrapper
18. `TaskExecutionTimeline.tsx` — fake progress

### Phase 4 — Extract interaction components
19. `TaskInteraction.tsx` — generic question + choices
20. `TaskApprovalGate.tsx` — approval cards (depends on EmailPreview, StructureList)

### Phase 5 — Assemble shell (depends on everything above)
21. `TaskErrorCard.tsx` — error bucketing + retry
22. `TaskCanvas.tsx` — thin shell that imports all of the above

**Rationale**: Start from the leaves (pure functions, isolated renderers) and work inward toward the root (shell). Each phase can be merged independently without breaking the existing monolith — just replace inline code with imports.
