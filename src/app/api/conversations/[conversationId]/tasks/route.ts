import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatTask } from '@/services/task-manager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/conversations/:conversationId/tasks — 获取会话中的所有任务
export async function GET(
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const { conversationId } = params;
    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value;

    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.userId !== userId) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    const tasks = await prisma.task.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: {
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return NextResponse.json(tasks.map(formatTask));
  } catch (error) {
    console.error('[CONVERSATION_TASKS_ERROR]', error);
    return NextResponse.json({ error: '获取任务列表失败' }, { status: 500 });
  }
}
