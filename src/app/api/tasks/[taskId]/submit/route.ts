import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

    const task = await prisma.task.findUnique({
      where: { id: params.taskId },
      select: { assigneeId: true, businessStatus: true },
    });

    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    if (task.assigneeId !== userId) {
      return NextResponse.json({ error: '无权提交此任务' }, { status: 403 });
    }

    // Extract result from the latest relevant TaskEvent (server-side, not from client)
    const lastResultEvent = await prisma.taskEvent.findFirst({
      where: {
        taskId: params.taskId,
        type: { in: ['result', 'step_update', 'task_completed', 'artifact'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { data: true },
    });

    let resultText: string | null = null;
    if (lastResultEvent) {
      try {
        const parsed = JSON.parse(lastResultEvent.data);
        resultText = JSON.stringify(parsed.content || parsed.result || parsed);
      } catch {
        resultText = lastResultEvent.data;
      }
    }

    await prisma.task.update({
      where: { id: params.taskId },
      data: {
        businessStatus: 'submitted',
        ...(resultText ? { result: resultText } : {}),
      },
    });

    return NextResponse.json({ success: true, businessStatus: 'submitted' });
  } catch (error) {
    console.error('[TASK_SUBMIT_ERROR]', error);
    return NextResponse.json({ error: '提交任务失败' }, { status: 500 });
  }
}
