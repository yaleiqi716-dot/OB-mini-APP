import { NextRequest, NextResponse } from 'next/server';
import { createTask, updateTaskStatus, emitLog } from '@/services/task-manager';
import { checkCredits, getOrCreateUser } from '@/services/billing';
import { estimateCost } from '@/lib/cost';
import { prisma } from '@/lib/prisma';

const PLAN_PRIORITY: Record<string, number> = { team: 3, pro: 2, basic: 1, free: 0 };

export async function POST(req: NextRequest) {
  try {
    // API key check
    const apiKey = req.headers.get('x-api-key');
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret && apiKey !== webhookSecret) {
      return NextResponse.json({ error: '认证失败' }, { status: 401 });
    }

    const body = await req.json();
    const { userId, type, input } = body;

    if (!userId || !input?.trim()) {
      return NextResponse.json({ error: '缺少 userId 或 input' }, { status: 400 });
    }

    // Validate user + credits
    const user = await getOrCreateUser(userId);
    const taskType = type || 'unknown';
    const creditCheck = await checkCredits(userId, taskType);
    if (!creditCheck.allowed) {
      return NextResponse.json({ error: creditCheck.reason }, { status: 403 });
    }

    // Create task
    const cost = estimateCost(taskType);
    const task = await createTask(input.trim(), 'api', {
      userId,
      estimatedCost: cost,
    });

    // Set priority + queue
    const priority = PLAN_PRIORITY[user.plan] || 0;
    await prisma.task.update({ where: { id: task.id }, data: { priority } });
    await updateTaskStatus(task.id, 'queued');
    await emitLog(task.id, '外部触发任务已提交');

    return NextResponse.json({
      success: true,
      taskId: task.id,
      estimatedCost: cost,
    }, { status: 202 });
  } catch (error) {
    console.error('[WEBHOOK_TRIGGER_ERROR]', error);
    return NextResponse.json({ error: '触发失败' }, { status: 500 });
  }
}
