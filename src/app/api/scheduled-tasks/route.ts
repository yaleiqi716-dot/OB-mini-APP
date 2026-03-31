import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function nextRunFromNow(cron: string): Date {
  const now = new Date();
  const next = new Date(now);
  if (cron === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await req.json();
    const { type, input, cron } = body;

    if (!input?.trim()) {
      return NextResponse.json({ error: '请输入任务内容' }, { status: 400 });
    }

    const schedule = cron === 'weekly' ? 'weekly' : 'daily';
    const nextRunAt = nextRunFromNow(schedule);

    const task = await prisma.scheduledTask.create({
      data: {
        type: type || 'unknown',
        input: input.trim(),
        cron: schedule,
        nextRunAt,
        userId,
      },
    });

    return NextResponse.json({
      id: task.id,
      type: task.type,
      cron: task.cron,
      nextRunAt: task.nextRunAt.toISOString(),
    });
  } catch (error) {
    console.error('[SCHEDULED_TASK_CREATE_ERROR]', error);
    return NextResponse.json({ error: '创建定时任务失败' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const tasks = await prisma.scheduledTask.findMany({
      where: { userId, enabled: true },
      orderBy: { nextRunAt: 'asc' },
      take: 50,
    });

    return NextResponse.json(tasks.map(t => ({
      id: t.id,
      type: t.type,
      input: t.input,
      cron: t.cron,
      nextRunAt: t.nextRunAt.toISOString(),
    })));
  } catch (error) {
    console.error('[SCHEDULED_TASK_LIST_ERROR]', error);
    return NextResponse.json({ error: '获取定时任务失败' }, { status: 500 });
  }
}
