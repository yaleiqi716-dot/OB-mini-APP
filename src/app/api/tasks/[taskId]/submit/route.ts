import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value;
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

    // Read optional result from request body
    let resultText: string | null = null;
    try {
      const body = await req.json();
      if (body.result) resultText = String(body.result);
    } catch {
      // No body is fine
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
