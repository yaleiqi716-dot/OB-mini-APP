# Legacy Assets Inventory for Migration

## 1. SSE Connection & Consumption

### Hook: `src/hooks/useSSE.ts` (81 lines)

| Property | Value |
|---|---|
| Signature | `useSSE(taskId: string \| null, options?)` → `{ connected, reconnecting }` |
| URL | `/api/tasks/${taskId}/events` |
| Backoff | 2s → 4s → 8s → ... max 15s (exponential) |
| Max retries | 10, then falls back to polling |
| Heartbeat | Server sends `: heartbeat\n\n` every 15s; client has no explicit handler |
| Cleanup | Closes EventSource on taskId change or unmount |

**Event types handled:**

| SSE Event Name | Handler | Line |
|---|---|---|
| `connected` | Sets `connected=true`, resets retry count | 31-35 |
| `task_event` | Parses JSON, calls `onEvent(event)` | 37-42 |
| `replay_complete` | No-op (empty handler) | 44 |

**onEvent processing (in page.tsx lines 456-468):**

| event.type | Action |
|---|---|
| `status_change` | Updates `task.status` |
| `interaction_request` | Sets `task.currentInteraction`, status → `interacting` |
| `artifact` | Updates `task.result` |
| `task_completed` | Sets result, status → `completed`, fetchQuota(), showSuccess() |

**Migration:** 🟢 easy — hook is self-contained, already at `src/hooks/useSSE.ts`, shared between old and new.

---

## 2. Task State Machine

### Definition: `src/types/task.ts` (lines 4-13)

**9 states:**
```
pending → queued → understanding → structuring → interacting → executing → completed
                                        ↑                              ↓
                                        └──────────── (user responds) ─┘
                                                                       ↓
                                                                    failed
                                                                       ↓
                                                                    blocked
```

**Transitions driven by:** SSE `status_change` events + 2s polling fallback.

**UI mapping (TaskCanvas lines 402-425):**

| Status | UI Label | Visual |
|---|---|---|
| pending/queued | READY / 准备启动 | Pulse dot |
| understanding | SIGNAL / 理解任务需求 | Active dot |
| structuring | PLAN / 整理执行方案 | Active dot |
| interacting | WAIT / 等待你的确认 | Active dot |
| executing | RUNNING / 正在生成内容 | Active dot |
| completed | 已完成 | Sand-colored badge |
| failed | (error card) | Red error hint |
| blocked | (blocked card) | Warning hint |

**Migration:** 🟢 easy — types already shared at `src/types/task.ts`.

---

## 3. Thinking Display

### Components involved:

| File | Lines | Function |
|---|---|---|
| `TaskCanvas.tsx` | 196-219 | `buildThinkingPhases(events)` — extracts `thinking` events |
| `TaskCanvas.tsx` | 92-113 | `humanizeThinking(text)` — converts technical text to conversational Chinese |
| `TaskCanvas.tsx` | 339-359 | Thinking stream assembly + closing line |
| `Typewriter.tsx` | 1-70 | Character-by-character reveal with append mode |

**Display form:** Italic text with left orange border, Typewriter effect (20ms/char).

**Data source:** SSE events with `type === 'thinking'` → `humanizeThinking()` transform → joined string → `<Typewriter>`.

**Append mode:** If new text starts with old text, Typewriter continues from where it left off (no reset). This creates a seamless stream as new thinking events arrive.

**Fake phases (ExecutionTimeline, lines 223-278):** 3 time-delayed placeholders shown before real events arrive:
- 0ms: "思考中..."
- 1800ms: "正在调用 AI 模型..."
- 4000ms: "生成中..."

Auto-hides when real thinking/step_update/log events arrive.

**Migration:** 🟡 medium — Typewriter can be copied directly, but humanize functions and thinking assembly need extraction from the TaskCanvas monolith.

---

## 4. Message Flow (Conversation View)

### Location: `agent-legacy/page.tsx` lines 846-920

**Structure:**
```
<div className="ob-scroll"> (scrollable container)
  For each task:
    <div className="ob-msg-user">       (user bubble — orange bg)
      {task.input}
    </div>
    <div className="ob-msg-ai">         (AI response area)
      <TaskCanvas ... />                 (full task rendering)
    </div>
  <div ref={canvasEndRef} />             (scroll anchor)
</div>
```

**User messages:** Orange bubble (`ob-msg-user-bubble`), right-aligned.
**AI messages:** Full TaskCanvas component with avatar, status, thinking, results.
**Streaming text:** Via Typewriter component (not word-by-word Markdown).
**Markdown rendering:** None — all output is plain text or structured JSX (slides, sections, etc.).
**Code highlighting:** None — no code block rendering.
**Auto-scroll:** `canvasEndRef.scrollIntoView({ behavior: 'smooth' })` on every render when activeTaskId exists (line 551-554).

**Migration:** 🟡 medium — layout is straightforward, but TaskCanvas (1112 lines) needs decomposition.

---

## 5. Attachment Upload

### Location: `src/components/agent-legacy/AgentInput.tsx` lines 98-126

**Implementation exists:** Yes, fully implemented.

| Property | Value |
|---|---|
| API endpoint | `POST /api/upload` |
| Method | FormData with `file` field |
| Max size | 10MB (client-side check at line 101) |
| Supported types | text/*, PDF, JSON, images, Office (docx/xlsx/pptx) |
| Progress display | None (just loading state) |
| Response | `{ success, file: { id, name, size, type, url } }` |

**Flow:**
1. Hidden `<input type="file" multiple>` triggered by button click
2. Each file POSTed individually to `/api/upload`
3. Response file object appended to `attachments` state array
4. On task submit, attachments array sent with task body
5. File names also appended to input text: `\n\n[附件: file1, file2]`
6. Remove button per attachment (line 124-126)

**Migration:** 🟢 easy — upload logic is self-contained. Copy `handleFileSelect` function + file input element.

---

## 6. Task Submission Flow

### Location: `agent-legacy/page.tsx` lines 587-645

**API:** REST `POST /api/tasks` (not tRPC).

**Pre-submit:**
1. Guard: `if (isSubmitting) return`
2. Create conversation if needed: `POST /api/conversations`
3. Build request body: `{ input, type, conversationId, attachments, skillRoleId }`

**Post-submit:**
1. Fetch full task: `GET /api/tasks/${taskId}`
2. Parse with `parseTaskFromAPI()`
3. Add to tasks array, set as active
4. Refresh quota + conversation list
5. SSE auto-connects via `useSSE(activeTaskId)`

**Error handling:**
- 429: "请求过于频繁" / "有任务正在执行"
- 403: "额度不足"
- 500: generic "提交失败"
- All shown via toast (3s auto-dismiss)

**Migration:** 🟢 easy — pure fetch calls, can be extracted into a `useTaskSubmit` hook.

---

## 7. Dependency Assets

### Packages (already installed, no new deps needed):

All used packages (`framer-motion`, `lucide-react`, `next`, `react`) are already in the project.
No Zustand/jotai/Redux store — all state is local useState.
No tRPC — all API calls use fetch().

### Shared utilities:

| File | Function | Used By | Migration |
|---|---|---|---|
| `src/hooks/useSSE.ts` | SSE client | page.tsx | 🟢 already shared |
| `src/types/task.ts` | TaskStatus, TaskType | page.tsx, TaskCanvas | 🟢 already shared |
| `src/types/interaction.ts` | Interaction types | page.tsx, TaskCanvas | 🟢 already shared |
| `src/lib/constants.ts` | TASK_TYPES | TaskCanvas | 🟢 already shared |
| `src/lib/utils.ts` | cn() | all components | 🟢 already shared |

### Legacy-only utilities (inside components):

| Function | File | Lines | Migration |
|---|---|---|---|
| `parseTaskFromAPI()` | page.tsx | 29-51 | 🟢 extract to util |
| `groupByDate()` | page.tsx | 333-354 | 🟢 extract to util |
| `humanizeThinking()` | TaskCanvas.tsx | 92-113 | 🟢 extract to util |
| `humanizeStep()` | TaskCanvas.tsx | 115-131 | 🟢 extract to util |
| `humanizeStatusBar()` | TaskCanvas.tsx | 133-146 | 🟢 extract to util |
| `getProgress()` | TaskCanvas.tsx | 150-158 | 🟢 extract to util |
| `getCompletedSteps()` | TaskCanvas.tsx | 174-194 | 🟢 extract to util |
| `buildThinkingPhases()` | TaskCanvas.tsx | 203-218 | 🟢 extract to util |
| `getNarrativeMode()` | TaskCanvas.tsx | 284-292 | 🟢 extract to util |
| `getApprovalType()` | TaskCanvas.tsx | 76-82 | 🟢 extract to util |

---

## Suggested Migration Order

| Phase | What | Difficulty | Depends On |
|---|---|---|---|
| 1 | Extract shared utils (parseTaskFromAPI, humanize*, getProgress) | 🟢 easy | Nothing |
| 2 | Wire task submission (handleSubmit → POST /api/tasks) | 🟢 easy | Phase 1 |
| 3 | Wire conversation list (real data replacing mock) | 🟢 easy | Phase 2 |
| 4 | Wire SSE + polling (useSSE hook + 2s fallback) | 🟡 medium | Phase 2 |
| 5 | Build conversation view (message bubbles + auto-scroll) | 🟡 medium | Phase 4 |
| 6 | Port Typewriter + thinking display | 🟡 medium | Phase 5 |
| 7 | Port TaskCanvas result rendering (11 types) | 🔴 hard | Phase 5-6 |
| 8 | Port approval gates + interaction panels | 🔴 hard | Phase 7 |
| 9 | Port error bucketing + retry logic | 🟡 medium | Phase 7 |
| 10 | Port file upload | 🟢 easy | Phase 2 |
