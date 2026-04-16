# Agent API Surface

All endpoints under `/api/`. Auth via `ob-session` cookie, `ob-user-id` cookie, or `x-user-id` header.

---

## Core Task Flow

### POST /api/conversations
Create a new conversation.

```
Request:  { title?: string }
Response: { id, title, createdAt, updatedAt }
Auth:     Required
```

### GET /api/conversations
List user's conversations (50 most recent).

```
Response: [{ id, title, createdAt, updatedAt, firstTaskInput, skillRoleId }]
Auth:     Required
```

### GET /api/conversations/:conversationId/tasks
Get all tasks in a conversation (with events).

```
Response: [{ id, type, status, title, input, events[], result, ... }]
Auth:     Required (ownership check)
```

### POST /api/tasks
Submit a new task.

```
Request: {
  input: string              // required
  type?: TaskType            // default: 'unknown'
  conversationId?: string    // omit → requires separate POST /api/conversations first
  skillRoleId?: string       // optional AI role
  attachments?: [{ id, name, size, type? }]
  source?: 'agent'|'zapier'|'api'
  metadata?: Record<string, string>
  assigneeId?: string
  parentTaskId?: string
}

Response: { taskId, type, status: 'queued', conversationId }
Auth:     Required
Checks:  Credit balance, rate limit (2s/IP), concurrency (max 20)
```

### GET /api/tasks/:taskId
Get task details with all events.

```
Response: { id, type, status, title, input, context, result, events[], createdAt, updatedAt }
Auth:     Optional (x-check-assignee header enforces)
```

### PATCH /api/tasks/:taskId
Retry a failed task.

```
Request:  { status: 'queued' }  // only valid value
Response: { success: true }
Auth:     Required
```

---

## Interaction Endpoints

### POST /api/tasks/:taskId/interact
Submit a user response to an AI question.

```
Request: {
  interactionId: string    // typically ''
  stepId: string           // e.g. 'revise_email', 'request_adjust_structure', 'agent_clarification'
  value: unknown           // string | boolean | object depending on interaction type
}

Response: { success: true }
Auth:     Background (not explicitly checked)
```

### POST /api/tasks/:taskId/approve
Handle approval gate (email send, structure confirm).

```
Request: {
  approvalType: 'send_email' | 'use_structure' | 'use_proposal_structure'
  action: 'approve' | 'reject'
}

Response: { success: true, action }
Auth:     Background
```

---

## Real-Time Events

### GET /api/tasks/:taskId/events
SSE stream for live task updates.

```
Protocol: text/event-stream
Events:
  - 'connected'        → { taskId }
  - 'task_event'       → { type, data, createdAt }
  - 'replay_complete'  → { count }
  - heartbeat          → every 15s

Event types in data.type:
  - status_change      → { status }
  - thinking           → { text }
  - step_update        → { step, text, current?, total? }
  - structure_generated → { structure[] }
  - interaction_request → Interaction object
  - artifact           → { result }
  - task_completed     → { result, cost }
  - error              → { message, code? }
  - insufficient_credits → {}
  - log                → { message }

Replay: up to 200 historical events on connect
```

---

## Supporting Endpoints

### GET /api/user
User status and quotas.

```
Response: { credits, plan, limits: { maxConcurrent, allowedTypes[] } }
Auth:     Required
```

### GET /api/skills
List AI roles (public, no auth).

```
Response (default):  { departments: [{ key, label, roles[] }] }
Response (?flat=1):  { roles: [{ id, department, name, description, color }] }
Response (?q=xxx):   { roles: [...filtered] }
Auth:     Not required
```

### GET /api/skills/hub
User's connected external skills.

```
Response: {
  connected: [{ instanceId, skillId, name, type, status, toolCount, ... }],
  quota: { browse: { used, limit }, mcp: { used, limit } }
}
Auth:     Required
```

### POST /api/upload
Upload a file attachment.

```
Request:  multipart/form-data (field: file)
Max:      10MB
Types:    text/*, application/pdf, application/json, image/*, docx, xlsx, pptx
Response: { success, file: { id, name, size, type, url } }
Auth:     Required
```

### POST /api/tasks/:taskId/unlock
Unlock a locked preview result (costs credits).

```
Response: { success: true }
Auth:     Required
```

---

## Data Flow Summary

```
User types prompt
  ↓
POST /api/conversations (if new)
  → { conversationId }
  ↓
POST /api/tasks { input, conversationId, skillRoleId? }
  → { taskId }
  ↓
GET /api/tasks/:taskId/events (SSE opens)
  ↓
  ← thinking events
  ← step_update events
  ← interaction_request (optional, pauses for user)
      ↓
      POST /api/tasks/:taskId/interact (user responds)
      POST /api/tasks/:taskId/approve (user confirms)
      ↓
  ← more step_update events
  ← task_completed { result, cost }
  ↓
Result rendered in TaskCanvas
```
