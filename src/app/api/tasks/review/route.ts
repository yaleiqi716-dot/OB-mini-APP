import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    const userFilter = userId ? { userId } : {};

    // 唯一真实状态源：status 字段（废弃 businessStatus）
    const tasks = await prisma.task.findMany({
      where: {
        ...userFilter,
        status: 'completed',
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        input: true,
        result: true,
        status: true,
        assigneeId: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 50,
    });

    return NextResponse.json(tasks.map(t => ({
      id: t.id,
      title: t.title,
      input: t.input,
      result: t.result ? safeParseJson(t.result) : null,
      status: t.status,
      assigneeId: t.assigneeId,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })));
  } catch (error) {
    console.error('[REVIEW_LIST_ERROR]', error);
    return NextResponse.json({ error: '获取待审核任务失败' }, { status: 500 });
  }
}

function safeParseJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return raw; }
}
