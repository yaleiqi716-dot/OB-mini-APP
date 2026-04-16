# Task Submit API Investigation

## 1. API Location

**Not tRPC** — plain REST API at `src/app/api/tasks/route.ts` (POST handler, line 52).

No tRPC client exists in this project. All API calls use `fetch()`.

## 2. Input Schema (CreateTaskRequest)

Source: `src/types/api.ts`

```typescript
interface CreateTaskRequest {
  input: string;                    // REQUIRED — task description
  type?: TaskType;                  // optional, default 'unknown' (auto-detect)
  source?: TaskSource;              // optional, default 'agent'
  metadata?: Record<string, string>;// optional
  assigneeId?: string;              // optional
  parentTaskId?: string;            // optional (chaining)
  conversationId?: string;          // optional (omit → auto-creates conversation)
  attachments?: Array<{             // optional
    id: string; name: string; size: number; type?: string
  }>;
  skillRoleId?: string;             // optional AI colleague role
}
```

## 3. Output Schema

```typescript
// Success (201-ish, actually 200)
{ taskId: string, type: string, status: 'queued', conversationId: string }

// Errors
{ error: string }  // 400/401/403/429/500
```

## 4. Auth

Uses `getUserIdFromRequest(req)` from `src/lib/auth.ts`.
Reads `ob-session` cookie → session table → userId.
Falls back to `ob-user-id` cookie or `x-user-id` header.
**Auth is required** — returns 401 if no userId.

## 5. Internal Dependencies

The POST handler calls:
1. `checkCredits(userId, type)` — billing check
2. `prisma.task.count()` — concurrency check (max 20)
3. `checkUserConcurrency(userId)` — plan-level concurrency
4. `getOrCreateUser(userId)` — get plan for priority
5. `prisma.conversation.create/findUnique` — conversation management
6. `getRoleById(skillRoleId)` — load AI colleague system prompt
7. `createTask(input, source, opts)` — insert task into DB
8. `updateTaskStatus(taskId, 'queued')` — move to queue
9. `emitLog(taskId, msg)` — emit SSE log event

Background services auto-start on first import (line 22-25):
- `startWorker(1000)` — polls DB for queued tasks, calls LLM
- `startAutoTaskRunner(60_000)`
- `startScheduler(60_000)`
- `startMediaJobPoller(10_000)`

Worker calls LLM via `src/lib/openrouter.ts` → OpenRouter API.

## 6. Environment Status

| Variable | Status | Required For |
|----------|--------|-------------|
| `DATABASE_URL` | Configured (SQLite dev.db) | All DB operations |
| `OPENROUTER_API_KEY` | **MISSING** | LLM calls (task execution) |
| `NEXT_PUBLIC_APP_URL` | Configured (localhost:3000) | URL generation |

**Task SUBMISSION will succeed** — it only needs the database.
**Task EXECUTION will fail** — the worker needs OPENROUTER_API_KEY to call the LLM.

This means: submitting a task will create it in DB with status 'queued', return a taskId, but the task will stay stuck at 'queued' forever (worker can't call the LLM).

## 7. Frontend ↔ API Field Mapping

| Frontend State | API Field | Match? |
|----------------|-----------|--------|
| `text` | `input` | Direct map |
| `roleId` | `skillRoleId` | Direct map |
| `modelId` | — | **NO API FIELD** (model is server-decided) |
| `mcpCount` | — | **NO API FIELD** (MCP not in task submit) |
| `files` (attachments) | `attachments` | Need upload first (POST /api/upload) |
| — | `conversationId` | Need to manage separately |
| — | `type` | Can omit (auto-detect) |
| — | `source` | Default 'agent' |

### Key gaps:
1. **modelId** — the API doesn't accept a model choice. Model is determined server-side by the worker/openrouter config. The frontend model selector is currently cosmetic.
2. **MCP tools** — not part of task submission. MCP connectors are a separate system (`/api/skills/hub`). Selected MCP tools would need to be communicated differently (possibly via `metadata` field or a new field).
3. **conversationId** — frontend needs to either create a conversation first (POST /api/conversations) or let the task API auto-create one. Legacy code creates conversation first, then submits task with conversationId.

## 8. Submission Flow (from legacy code)

```
1. User types prompt
2. If no currentConversationId:
   POST /api/conversations { title: input.slice(0,40) }
   → get conversationId
3. POST /api/tasks {
     input,
     conversationId,
     skillRoleId: roleId || undefined,
     attachments: files || undefined,
   }
   → get { taskId, status: 'queued', conversationId }
4. GET /api/tasks/:taskId (fetch full task state)
5. Open SSE /api/tasks/:taskId/events
6. Poll GET /api/tasks/:taskId every 2s as backup
```

## 9. Can We Call It Locally?

| Step | Works? | Notes |
|------|--------|-------|
| POST /api/conversations | Yes | Only needs DB |
| POST /api/tasks | Yes | Only needs DB for submission |
| Task execution (worker) | **No** | Needs OPENROUTER_API_KEY |
| SSE /api/tasks/:id/events | Yes | Streams from DB events |
| GET /api/tasks/:id | Yes | Reads from DB |

**Conclusion**: We can wire up the submit button today. Tasks will be created and appear in the DB. They'll stay at 'queued' status since there's no LLM key, but the full UI flow (submit → show task → SSE subscribe) can be tested structurally.
