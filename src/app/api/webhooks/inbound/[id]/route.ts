import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { createTask, updateTaskStatus, emitLog } from '@/services/task-manager';
import { checkCredits } from '@/services/billing';

export const runtime = 'nodejs';

// POST /api/webhooks/inbound/[id]
//
// External systems (Zapier, n8n, custom apps) POST here to create OB
// resources on behalf of a user. Auth is via the X-OrangeBench-Inbound-Secret
// header — the caller must include the 64-char hex secret that was
// generated when the inbound endpoint was created (returned ONCE in the
// create response, like the outbound signing secret).
//
// Body shape (for action='create_agent_task'):
//   {
//     input: string (required) — the task prompt, same as if the user typed it in /agent
//     title?: string — optional explicit title (worker derives from input otherwise)
//     metadata?: { source?: string, ... } — optional caller-provided context
//   }
//
// Auth strategy: shared secret only. No CSRF concerns (this is intentional
// machine-to-machine). No CORS (browser callers need a server proxy).
// Constant-time comparison via timingSafeEqual to prevent timing attacks.
//
// Rate limiting: per-inbound failureCount tracker. Auto-disable after
// 10 consecutive auth failures (someone is brute-forcing the secret).
//
// Returns:
//   { success: true, taskId: '...', taskUrl: '/agent?conversationId=...' }
//   or
//   { error: '...' } with 401/400/422/500 status

const AUTO_DISABLE_THRESHOLD = 10;

function safeEqualHex(a: string, b: string): boolean {
  // Both must be the same byte length for timingSafeEqual.
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

function clientIp(req: NextRequest): string {
  // Trust x-forwarded-for if present (assumes deployment behind a proxy
  // that scrubs untrusted incoming x-f-f). Falls back to req.ip if exposed.
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim().slice(0, 64);
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.slice(0, 64);
  return 'unknown';
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const startedAt = Date.now();
  const ip = clientIp(req);

  // Look up the inbound endpoint. Don't reveal whether the id exists vs
  // the secret is wrong — both go through the same code path.
  const inbound = await prisma.webhookInbound.findUnique({ where: { id: params.id } });

  // Read auth header
  const providedSecret = req.headers.get('x-orangebench-inbound-secret') || '';

  // Read body for logging even if auth fails (truncated, never echoed back)
  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch {
    rawBody = '';
  }

  // Auth check — constant time
  if (!inbound || !inbound.active || !safeEqualHex(providedSecret, inbound.secret)) {
    // Log the failed attempt if the inbound exists (for the user to see in audit)
    if (inbound) {
      await prisma.webhookInbound.update({
        where: { id: inbound.id },
        data: {
          failureCount: { increment: 1 },
          // Auto-disable after threshold
          active: inbound.failureCount + 1 >= AUTO_DISABLE_THRESHOLD ? false : inbound.active,
        },
      }).catch(() => {});
      await prisma.webhookInboundLog.create({
        data: {
          inboundId: inbound.id,
          status: 'auth_failed',
          payload: rawBody.slice(0, 4096),
          errorMsg: !inbound.active ? 'endpoint disabled' : 'wrong secret',
          ipAddress: ip,
        },
      }).catch(() => {});
    }
    // Constant 401 regardless of which check failed
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse body as JSON
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    await prisma.webhookInboundLog.create({
      data: {
        inboundId: inbound.id,
        status: 'validation_failed',
        payload: rawBody.slice(0, 4096),
        errorMsg: 'request body must be valid JSON',
        ipAddress: ip,
      },
    }).catch(() => {});
    return NextResponse.json({ error: '请求体必须是合法 JSON' }, { status: 400 });
  }

  // Dispatch on action
  if (inbound.action === 'create_agent_task') {
    const input = typeof body.input === 'string' ? body.input.trim() : '';
    if (!input) {
      await prisma.webhookInboundLog.create({
        data: {
          inboundId: inbound.id,
          status: 'validation_failed',
          payload: rawBody.slice(0, 4096),
          errorMsg: '缺少必填字段 input',
          ipAddress: ip,
        },
      }).catch(() => {});
      return NextResponse.json({ error: '缺少必填字段 input' }, { status: 400 });
    }

    // Check the user's credit budget for a default text task. Inbound
    // tasks consume the same budget as user-typed tasks. If insufficient,
    // we don't create the task.
    const creditCheck = await checkCredits(inbound.userId, 'unknown');
    if (!creditCheck.allowed) {
      await prisma.webhookInboundLog.create({
        data: {
          inboundId: inbound.id,
          status: 'action_failed',
          payload: rawBody.slice(0, 4096),
          errorMsg: creditCheck.reason || 'insufficient credits',
          ipAddress: ip,
        },
      }).catch(() => {});
      return NextResponse.json({ error: creditCheck.reason || '余额不足' }, { status: 402 });
    }

    try {
      // Create a conversation first so the task lives in /agent and the
      // user can see it in their conversation history.
      const conversation = await prisma.conversation.create({
        data: { userId: inbound.userId, title: null },
      });

      // Create the task — same shape as POST /api/tasks would
      const task = await createTask(input, 'agent', {
        userId: inbound.userId,
        estimatedCost: creditCheck.estimatedCost,
        assigneeId: inbound.userId,
      });
      // Pin it to the conversation + queue it for the worker
      await prisma.task.update({
        where: { id: task.id },
        data: { conversationId: conversation.id },
      });
      await updateTaskStatus(task.id, 'queued');
      await emitLog(task.id, `任务通过入站 webhook 创建 (来源: ${ip})`);

      // Update inbound stats
      await prisma.webhookInbound.update({
        where: { id: inbound.id },
        data: {
          callCount: { increment: 1 },
          failureCount: 0, // reset on success
          lastFiredAt: new Date(),
        },
      }).catch(() => {});
      await prisma.webhookInboundLog.create({
        data: {
          inboundId: inbound.id,
          status: 'success',
          payload: rawBody.slice(0, 4096),
          resourceId: task.id,
          ipAddress: ip,
        },
      }).catch(() => {});

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return NextResponse.json({
        success: true,
        taskId: task.id,
        conversationId: conversation.id,
        taskUrl: `${appUrl}/agent?conversationId=${conversation.id}`,
        durationMs: Date.now() - startedAt,
      });
    } catch (err) {
      console.error('[INBOUND_CREATE_TASK_ERROR]', err);
      const errMsg = err instanceof Error ? err.message : 'unknown';
      await prisma.webhookInboundLog.create({
        data: {
          inboundId: inbound.id,
          status: 'action_failed',
          payload: rawBody.slice(0, 4096),
          errorMsg: errMsg.slice(0, 1024),
          ipAddress: ip,
        },
      }).catch(() => {});
      return NextResponse.json({ error: '创建任务失败' }, { status: 500 });
    }
  }

  // Unknown action
  await prisma.webhookInboundLog.create({
    data: {
      inboundId: inbound.id,
      status: 'validation_failed',
      payload: rawBody.slice(0, 4096),
      errorMsg: `unknown action: ${inbound.action}`,
      ipAddress: ip,
    },
  }).catch(() => {});
  return NextResponse.json({ error: '不支持的 action 类型' }, { status: 400 });
}
