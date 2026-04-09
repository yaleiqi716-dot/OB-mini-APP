import { prisma } from '@/lib/prisma';

// Outbound webhook dispatcher — Phase 3 of the Skills Integration Plan.
//
// Fires JSON POST to every active WebhookEndpoint subscribed to a given
// event for a given user. Each delivery is logged to WebhookLog with
// status_code + duration_ms + truncated error body so the user can
// debug why a Zap isn't firing.
//
// Failure handling:
//   - 3 retry attempts with linear backoff (200ms, 400ms, 800ms)
//   - On final failure, increment failureCount and write error to lastError
//   - After 5 consecutive failures, the endpoint is auto-disabled
//   - Errors are caught — fireWebhooks() never throws upward, so it can
//     be safely .catch(()=>{}) at every callsite without losing data
//
// All fires are fire-and-forget from the caller's perspective: we kick
// off the async dispatch and return. The caller doesn't await.

export type WebhookEvent =
  | 'task_assigned'
  | 'task_submitted'
  | 'task_revision'
  | 'task_completed'
  | 'workspace_invite_accepted'
  | 'agent_task_completed';

// Standard envelope for every outbound delivery. Stable across event types
// so consumer Zaps can rely on the shape. Event-specific fields go under `data`.
export interface WebhookPayload {
  // Stable across all events
  event: WebhookEvent;
  timestamp: string; // ISO 8601 UTC
  source: 'orangebench';
  // Event-specific data — different shape per event
  data: Record<string, unknown>;
  // Useful for debugging
  delivery: {
    id: string;
    endpointId: string;
  };
}

// Builders for the 4 task events. Each takes the same arguments as the
// corresponding wecom.notify* function and returns the data block.
export const payloads = {
  taskAssigned(args: {
    workspaceId: string;
    taskId: string;
    taskTitle: string;
    ownerName: string;
    assigneeId?: string;
  }) {
    return {
      workspace_id: args.workspaceId,
      task_id: args.taskId,
      task_title: args.taskTitle,
      assignee_id: args.assigneeId,
      assigned_by_name: args.ownerName,
      task_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://orangebench.tech'}/workspace/tasks/${args.taskId}`,
    };
  },
  taskSubmitted(args: {
    workspaceId: string;
    taskId: string;
    taskTitle: string;
    memberName: string;
    ownerId?: string;
  }) {
    return {
      workspace_id: args.workspaceId,
      task_id: args.taskId,
      task_title: args.taskTitle,
      submitted_by_name: args.memberName,
      reviewer_id: args.ownerId,
      task_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://orangebench.tech'}/workspace/tasks/${args.taskId}`,
    };
  },
  taskRevision(args: {
    workspaceId: string;
    taskId: string;
    taskTitle: string;
    feedbackPreview: string;
    assigneeId?: string;
  }) {
    return {
      workspace_id: args.workspaceId,
      task_id: args.taskId,
      task_title: args.taskTitle,
      assignee_id: args.assigneeId,
      feedback: args.feedbackPreview,
      task_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://orangebench.tech'}/workspace/tasks/${args.taskId}`,
    };
  },
  taskCompleted(args: {
    workspaceId: string;
    taskId: string;
    taskTitle: string;
    assigneeId?: string;
  }) {
    return {
      workspace_id: args.workspaceId,
      task_id: args.taskId,
      task_title: args.taskTitle,
      assignee_id: args.assigneeId,
      task_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://orangebench.tech'}/workspace/tasks/${args.taskId}`,
    };
  },
};

// Hard limits to bound DB row size and prevent log table runaway.
const MAX_PAYLOAD_LENGTH = 4096;
const MAX_ERROR_LENGTH = 1024;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 200;
const AUTO_DISABLE_FAILURE_THRESHOLD = 5;
const FETCH_TIMEOUT_MS = 10_000;

// Sleep helper for retry backoff.
function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// Try a single POST with timeout. Returns { ok, statusCode, errorMsg }.
async function attemptPost(
  url: string,
  body: string,
): Promise<{ ok: boolean; statusCode: number | null; errorMsg: string | null }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'OrangeBench-Webhook/1.0',
      },
      body,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (r.ok) return { ok: true, statusCode: r.status, errorMsg: null };
    // Read at most MAX_ERROR_LENGTH chars of the error body for debug
    const errText = (await r.text().catch(() => '')).slice(0, MAX_ERROR_LENGTH);
    return { ok: false, statusCode: r.status, errorMsg: errText || `HTTP ${r.status}` };
  } catch (err) {
    clearTimeout(t);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, statusCode: null, errorMsg: msg.slice(0, MAX_ERROR_LENGTH) };
  }
}

// Determine whether an endpoint subscribes to a given event. Empty/null
// events array = subscribed to ALL events.
function isSubscribed(endpointEventsJson: string | null, event: WebhookEvent): boolean {
  if (!endpointEventsJson) return true;
  try {
    const arr = JSON.parse(endpointEventsJson);
    if (!Array.isArray(arr) || arr.length === 0) return true;
    return arr.includes(event);
  } catch {
    return true; // malformed → fail open, deliver
  }
}

// Main entry point. Fire-and-forget from caller's perspective.
//
//   userId — whose webhooks should fire? (the recipient of the event)
//   event  — discriminator (one of the WebhookEvent enum values)
//   data   — event-specific data block (use payloads.* helpers)
//
// Errors are caught and logged but never thrown. Safe to call inside
// hot paths without try/catch.
export async function fireWebhooks(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    // Find all active endpoints for this user.
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { userId, active: true },
    });
    if (endpoints.length === 0) return;

    // Filter to those subscribed to this specific event.
    const subscribed = endpoints.filter(e => isSubscribed(e.events, event));
    if (subscribed.length === 0) return;

    // Fire each in parallel. Each delivery is independent.
    await Promise.all(
      subscribed.map(async endpoint => {
        const deliveryId = `${endpoint.id}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
        const envelope: WebhookPayload = {
          event,
          timestamp: new Date().toISOString(),
          source: 'orangebench',
          data,
          delivery: { id: deliveryId, endpointId: endpoint.id },
        };
        let body = JSON.stringify(envelope);
        if (body.length > MAX_PAYLOAD_LENGTH) {
          // Drop the data block if too large; keep the envelope so consumer
          // still sees what type of event fired.
          body = JSON.stringify({
            ...envelope,
            data: { _truncated: true, original_size: body.length },
          });
        }

        // Retry loop
        const start = Date.now();
        let lastResult: { ok: boolean; statusCode: number | null; errorMsg: string | null } = {
          ok: false,
          statusCode: null,
          errorMsg: 'no attempt',
        };
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          if (attempt > 0) await sleep(RETRY_BASE_MS * Math.pow(2, attempt - 1));
          lastResult = await attemptPost(endpoint.url, body);
          if (lastResult.ok) break;
        }
        const durationMs = Date.now() - start;

        // Log the result regardless of outcome
        await prisma.webhookLog.create({
          data: {
            endpointId: endpoint.id,
            event,
            payload: body.slice(0, MAX_PAYLOAD_LENGTH),
            statusCode: lastResult.statusCode,
            errorMsg: lastResult.errorMsg,
            durationMs,
          },
        }).catch(() => {
          // Logging failures shouldn't take down the dispatch
        });

        // Update endpoint state
        if (lastResult.ok) {
          await prisma.webhookEndpoint.update({
            where: { id: endpoint.id },
            data: {
              lastFiredAt: new Date(),
              failureCount: 0, // reset on success
              lastError: null,
            },
          }).catch(() => {});
        } else {
          const newFailureCount = endpoint.failureCount + 1;
          await prisma.webhookEndpoint.update({
            where: { id: endpoint.id },
            data: {
              lastFiredAt: new Date(),
              failureCount: newFailureCount,
              lastError: lastResult.errorMsg?.slice(0, MAX_ERROR_LENGTH),
              // Auto-disable after threshold
              active: newFailureCount >= AUTO_DISABLE_FAILURE_THRESHOLD ? false : true,
            },
          }).catch(() => {});
        }
      }),
    );
  } catch (err) {
    console.error('[WEBHOOK_DISPATCH_ERROR]', err);
    // Never throw — caller is in a hot path
  }
}
