import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value;
    const userFilter = userId ? { userId } : {};

    // Preview mode: return submitted + completed tasks so review page is never empty
    const tasks = await prisma.task.findMany({
      where: {
        ...userFilter,
        OR: [
          { businessStatus: 'submitted' },
          { businessStatus: 'completed' },
          { status: 'completed' },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        input: true,
        result: true,
        businessStatus: true,
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
      businessStatus: t.businessStatus || t.status,
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
