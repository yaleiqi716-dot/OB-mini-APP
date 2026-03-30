import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkflow } from '@/services/workflows';
import { ApprovalType, ApprovalAction } from '@/types/interaction';
import { TaskType } from '@/types/task';

import '@/services/workflows';

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { taskId } = params;
    const body = await req.json();
    const approvalType = body.approvalType as ApprovalType;
    const action = (body.action as ApprovalAction) || 'approve';

    if (!approvalType) {
      return NextResponse.json({ error: '缺少 approvalType' }, { status: 400 });
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: '无效的 action，必须为 approve 或 reject' }, { status: 400 });
    }

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    const workflow = getWorkflow(task.type as TaskType);
    if (!workflow) {
      return NextResponse.json({ error: '未找到对应的工作流' }, { status: 400 });
    }

    // Delegate to workflow — runs in background
    (async () => {
      try {
        await workflow.handleApproval(
          { taskId, input: task.input, context: {} },
          approvalType,
          action
        );
      } catch (err) {
        const { failTask } = await import('@/services/task-manager');
        await failTask(taskId, err instanceof Error ? err.message : '审批处理失败');
      }
    })();

    return NextResponse.json({ success: true, action });
  } catch (error) {
    return NextResponse.json(
      { error: '审批失败', detail: String(error) },
      { status: 500 }
    );
  }
}
