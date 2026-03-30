import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addCredits, getOrCreateUser } from '@/services/billing';
import { updateTaskStatus, emitLog } from '@/services/task-manager';

export async function GET(req: NextRequest) {
  // Mock payment completion via GET (for testing)
  const orderId = req.nextUrl.searchParams.get('orderId');
  const isMock = req.nextUrl.searchParams.get('mock') === 'true';

  if (!orderId) {
    return NextResponse.json({ error: '缺少 orderId' }, { status: 400 });
  }

  if (isMock) {
    const result = await processPayment(orderId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    // Redirect back to agent page
    return NextResponse.redirect(new URL('/agent', req.url));
  }

  return NextResponse.json({ error: '无效请求' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  // Real payment webhook (WeChat/Alipay/PayPal callback)
  try {
    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: '缺少 orderId' }, { status: 400 });
    }

    const result = await processPayment(orderId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, credits: result.credits });
  } catch (error) {
    console.error('[PAYMENT_WEBHOOK_ERROR]', error);
    return NextResponse.json({ error: '处理失败' }, { status: 500 });
  }
}

async function processPayment(orderId: string): Promise<{ success: boolean; error?: string; credits?: number }> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });

  if (!order) {
    return { success: false, error: '订单不存在' };
  }

  if (order.status === 'paid') {
    return { success: true, credits: order.credits }; // Idempotent
  }

  if (order.status === 'failed') {
    return { success: false, error: '订单已失败' };
  }

  // Mark as paid
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'paid' },
  });

  // Add credits to user
  const user = await addCredits(order.userId, order.credits);
  console.log(`[PAYMENT] Order ${orderId} paid: +${order.credits} credits for user ${order.userId}`);

  // Auto-requeue failed tasks that were blocked by insufficient credits
  await requeueBlockedTasks(order.userId);

  return { success: true, credits: user.credits };
}

async function requeueBlockedTasks(userId: string) {
  // Find tasks that failed due to credits
  const blockedTasks = await prisma.task.findMany({
    where: {
      userId,
      status: 'failed',
      OR: [
        { errorMessage: { contains: '余额不足' } },
        { errorMessage: { contains: '额度不足' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 3, // Re-queue at most 3
  });

  for (const task of blockedTasks) {
    try {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'queued',
          errorMessage: null,
          charged: false,
          cost: 0,
          isExecuting: false,
          processing: false,
        },
      });
      await updateTaskStatus(task.id, 'queued');
      await emitLog(task.id, '充值成功，任务已恢复执行');
      console.log(`[PAYMENT] Requeued task ${task.id} after payment`);
    } catch (err) {
      console.error(`[PAYMENT] Failed to requeue task ${task.id}:`, err);
    }
  }
}
