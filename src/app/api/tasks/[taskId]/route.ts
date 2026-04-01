import { NextRequest, NextResponse } from 'next/server';
import { getTaskFormatted } from '@/services/task-manager';
import { prisma } from '@/lib/prisma';
import { enqueue } from '@/services/task-queue';

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value;
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const body = await req.json();
    const { status } = body;
    // Only allow retrying failed tasks by resetting to queued
    if (status !== 'queued') {
      return NextResponse.json({ error: '不支持该状态变更' }, { status: 400 });
    }
    const task = await prisma.task.findUnique({
      where: { id: params.taskId },
      select: { id: true, assigneeId: true, status: true },
    });
    if (!task) return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    if (task.status !== 'failed') {
      return NextResponse.json({ error: '只有失败的任务才能重试' }, { status: 400 });
    }
    await prisma.task.update({
      where: { id: params.taskId },
      data: { status: 'queued', errorMessage: null },
    });
    // Re-enqueue the task for execution
    enqueue({ taskId: params.taskId, enqueuedAt: Date.now() });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}
