import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value;
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
        status: true,   // 唯一真实状态源
        type: true,
        createdAt: true,
      },
      take: 50,
    });

    return NextResponse.json(tasks.map(t => ({
      id: t.id,
      title: t.title || t.input?.slice(0, 40) || '无标题任务',
      status: t.status,
      type: t.type,
      createdAt: t.createdAt.toISOString(),
    })));
  } catch (error) {
    console.error('[TASKS_MINE_ERROR]', error);
    return NextResponse.json({ error: '获取指派任务失败' }, { status: 500 });
  }
}
