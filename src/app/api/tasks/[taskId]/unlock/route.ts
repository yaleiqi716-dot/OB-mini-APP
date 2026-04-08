import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrCreateUser } from '@/services/billing';
import { estimateCost } from '@/lib/cost';
import { getUserIdFromRequest } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const task = await prisma.task.findUnique({ where: { id: params.taskId } });
    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    if (task.status !== 'completed') {
      return NextResponse.json({ error: '任务未完成' }, { status: 400 });
    }

    // Already unlocked (charged)
    if (task.charged) {
      const result = task.result ? JSON.parse(task.result) : null;
      return NextResponse.json({ success: true, result });
    }

    // Check + deduct credits
    const cost = estimateCost(task.type);
    const user = await getOrCreateUser(userId);

    if (user.credits < cost) {
      return NextResponse.json({
        error: `额度不足（需要 ${cost}，剩余 ${user.credits}），请充值`,
        required: cost,
        current: user.credits,
      }, { status: 403 });
    }

    // Atomic: deduct credits + mark charged
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { credits: user.credits - cost },
      }),
      prisma.task.update({
        where: { id: params.taskId },
        data: { charged: true, cost, actualCost: cost },
      }),
    ]);

    const result = task.result ? JSON.parse(task.result) : null;
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[UNLOCK_ERROR]', error);
    return NextResponse.json({ error: '解锁失败' }, { status: 500 });
  }
}
