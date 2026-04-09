import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

// POST /api/webhooks/[id]/test — fire a synthetic test event at this endpoint.
// Useful for the user to verify their Zapier URL is wired correctly without
// having to actually create + assign + submit + review a real workspace task.
//
// The test payload uses event type 'task_assigned' with placeholder data so
// it matches the shape Zapier sees in real fires. The endpoint must be active.
//
// IMPORTANT: this fires through the same dispatcher as real events, so it
// counts toward the failure threshold and writes to WebhookLog. The "test"
// origin is marked in the data block so the user can distinguish it from
// real fires when reading their Zap inbox.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { id: params.id },
    });
    if (!endpoint) return NextResponse.json({ error: '不存在' }, { status: 404 });
    if (endpoint.userId !== userId) return NextResponse.json({ error: '无权限' }, { status: 403 });

    // Fire a synthetic event. Even if the endpoint isn't subscribed to
    // task_assigned, fireWebhooks will skip it — but for a test we WANT
    // delivery regardless of subscription. So we temporarily set events
    // to null (subscribe to all) for this one call by reading the existing
    // value, calling fireWebhooks, then NOT updating the row.
    //
    // Simplest approach: call fireWebhooks. If endpoint isn't subscribed
    // to task_assigned, the dispatcher silently skips it — and we'd return
    // success with 0 deliveries. That's confusing.
    //
    // Better: bypass the subscription check by writing directly here.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const testPayload = {
      event: 'task_assigned',
      timestamp: new Date().toISOString(),
      source: 'orangebench',
      data: {
        _test: true,
        message: '这是一条来自 OrangeBench 的测试 webhook 事件',
        workspace_id: 'test-workspace',
        task_id: 'test-task',
        task_title: 'Webhook 测试任务',
        assignee_id: userId,
        assigned_by_name: 'OrangeBench 测试',
        task_url: `${appUrl}/workspace`,
      },
      delivery: { id: `test-${Date.now()}`, endpointId: endpoint.id },
    };

    const start = Date.now();
    let statusCode: number | null = null;
    let errorMsg: string | null = null;
    let ok = false;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10_000);
      const r = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'OrangeBench-Webhook/1.0 (test)',
        },
        body: JSON.stringify(testPayload),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      statusCode = r.status;
      ok = r.ok;
      if (!r.ok) {
        errorMsg = (await r.text().catch(() => '')).slice(0, 1024) || `HTTP ${r.status}`;
      }
    } catch (err) {
      errorMsg = (err instanceof Error ? err.message : String(err)).slice(0, 1024);
    }
    const durationMs = Date.now() - start;

    // Log the test fire
    await prisma.webhookLog.create({
      data: {
        endpointId: endpoint.id,
        event: 'task_assigned',
        payload: JSON.stringify(testPayload).slice(0, 4096),
        statusCode,
        errorMsg,
        durationMs,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: ok,
      statusCode,
      errorMsg,
      durationMs,
      message: ok ? '✓ 测试 webhook 已成功发送' : '✗ 测试发送失败',
    });
  } catch (err) {
    console.error('[WEBHOOK_TEST_ERROR]', err);
    return NextResponse.json({ error: '测试失败' }, { status: 500 });
  }
}
