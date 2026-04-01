import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    const tasks = await prisma.task.findMany({
      where: { OR: [{ assigneeId: userId }, { userId }] },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        input: true,
        status: true,
        type: true,
        createdAt: true,
        assigneeId: true,
        userId: true,
      },
      take: 50,
    });
    return NextResponse.json(tasks.map(t => ({
      id: t.id,
      title: t.title || t.input?.slice(0, 40) || '无标题任务',
      status: t.status,
      type: t.type,
      createdAt: t.createdAt.toISOString(),
      isAssigned: t.assigneeId === userId && t.userId !== userId,
    })));
  } catch (error) {
    console.error('[TASKS_MINE_ERROR]', error);
    return NextResponse.json({ error: '获取指派任务失败' }, { status: 500 });
  }
}
