import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

// POST — Owner reviews: approve or request revision
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const task = await prisma.workspaceTask.findUnique({ where: { id: params.id } });
    if (!task) return NextResponse.json({ error: '任务不存在' }, { status: 404 });

    // Only workspace owner can review
    const workspace = await prisma.workspace.findUnique({ where: { id: task.workspaceId } });
    if (!workspace || workspace.ownerId !== userId) {
      return NextResponse.json({ error: '只有 Owner 可以审核' }, { status: 403 });
    }

    // Can only review from submitted state
    if (task.businessStatus !== 'submitted') {
      return NextResponse.json({ error: `当前状态 ${task.businessStatus} 不允许审核操作` }, { status: 400 });
    }

    const body = await req.json();
    const { action, feedback } = body as { action: 'approve' | 'revision'; feedback?: string };

    if (action === 'approve') {
      // MVP: approve goes directly to completed (no separate approved state)
      const updated = await prisma.workspaceTask.update({
        where: { id: params.id },
        data: { businessStatus: 'completed' },
      });
      return NextResponse.json({ success: true, task: updated });
    }

    if (action === 'revision') {
      if (!feedback || !feedback.trim()) {
        return NextResponse.json({ error: '请填写修改意见' }, { status: 400 });
      }
      const updated = await prisma.workspaceTask.update({
        where: { id: params.id },
        data: {
          businessStatus: 'revision',
          feedback: feedback.trim(),
          submissionSummary: null, // clear previous submission
        },
      });
      return NextResponse.json({ success: true, task: updated });
    }

    return NextResponse.json({ error: '无效操作，action 必须是 approve 或 revision' }, { status: 400 });
  } catch (error) {
    console.error('[WS_TASK_REVIEW_ERROR]', error);
    return NextResponse.json({ error: '审核失败' }, { status: 500 });
  }
}
