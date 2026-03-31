import { NextRequest, NextResponse } from 'next/server';
import { getTaskFormatted } from '@/services/task-manager';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value;

    // If request includes x-check-assignee header, enforce assignee permission
    if (req.headers.get('x-check-assignee') === '1') {
      if (!userId) {
        return NextResponse.json({ error: '未登录' }, { status: 401 });
      }
      const task = await prisma.task.findUnique({
        where: { id: params.taskId },
        select: { assigneeId: true },
      });
      if (!task) {
        return NextResponse.json({ error: '任务不存在' }, { status: 404 });
      }
      if (task.assigneeId !== userId) {
        return NextResponse.json({ error: '无权查看此任务' }, { status: 403 });
      }
    }

    const task = await getTaskFormatted(params.taskId);
    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }
    return NextResponse.json(task);
  } catch (error) {
    return NextResponse.json({ error: '获取任务失败' }, { status: 500 });
  }
}
