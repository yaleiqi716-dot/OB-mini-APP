import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { notifyTaskSubmitted } from '@/services/wecom';

// POST — Member submits deliverable
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const task = await prisma.workspaceTask.findUnique({
      where: { id: params.id },
      include: { links: true },
    });
    if (!task) return NextResponse.json({ error: '任务不存在' }, { status: 404 });

    // Only assignee can submit
    if (task.assigneeId !== userId) {
      return NextResponse.json({ error: '只有任务负责人可以提交' }, { status: 403 });
    }

    // Can only submit from in_progress or revision
    if (!['in_progress', 'revision'].includes(task.businessStatus)) {
      return NextResponse.json({ error: `当前状态 ${task.businessStatus} 不允许提交` }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { submissionSummary, agentTaskId } = body as { submissionSummary?: string; agentTaskId?: string };

    // If specific agent task provided, mark its link as submitted
    if (agentTaskId) {
      const link = task.links.find(l => l.agentTaskId === agentTaskId);
      if (link) {
        await prisma.workspaceTaskLink.update({
          where: { id: link.id },
          data: { purpose: 'final', submittedAt: new Date() },
        });
      }
    } else if (task.links.length > 0) {
      // Default: mark the latest link as final
      const latest = task.links[task.links.length - 1];
      await prisma.workspaceTaskLink.update({
        where: { id: latest.id },
        data: { purpose: 'final', submittedAt: new Date() },
      });
    }

    const updated = await prisma.workspaceTask.update({
      where: { id: params.id },
      data: {
        businessStatus: 'submitted',
        submissionSummary: submissionSummary?.trim() || null,
      },
    });

    // WeCom notification
    const member = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    notifyTaskSubmitted(task.workspaceId, task.title, member?.name || member?.email || '成员', task.id).catch(() => {});

    return NextResponse.json({ success: true, task: updated });
  } catch (error) {
    console.error('[WS_TASK_SUBMIT_ERROR]', error);
    return NextResponse.json({ error: '提交失败' }, { status: 500 });
  }
}
