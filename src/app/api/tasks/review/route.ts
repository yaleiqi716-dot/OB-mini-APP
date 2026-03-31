import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const tasks = await prisma.task.findMany({
      where: { businessStatus: 'submitted' },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        input: true,
        result: true,
        businessStatus: true,
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
      businessStatus: t.businessStatus,
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
