import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitEvent, emitLog, completeTask, getTaskContext } from '@/services/task-manager';
import { ApprovalType } from '@/types/interaction';

import '@/services/workflows';

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { taskId } = params;
    const body = await req.json();
    const approvalType = body.approvalType as ApprovalType;

    if (!approvalType) {
      return NextResponse.json({ error: '缺少 approvalType' }, { status: 400 });
    }

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    // Route by approval type
    switch (approvalType) {
      case 'use_structure':
        return handleStructureApproval(taskId, task);

      case 'send_email':
        return handleEmailApproval(taskId, task);

      default:
        return NextResponse.json(
          { error: `不支持的审批类型: ${approvalType}` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: '审批失败', detail: String(error) },
      { status: 500 }
    );
  }
}

async function handleStructureApproval(
  taskId: string,
  task: { status: string; type: string; input: string }
) {
  if (task.status !== 'structuring' && task.status !== 'interacting') {
    return NextResponse.json(
      { error: '任务当前不在结构确认阶段' },
      { status: 400 }
    );
  }

  if (task.type !== 'ppt') {
    return NextResponse.json(
      { error: '当前任务类型不支持结构审批' },
      { status: 400 }
    );
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { status: 'executing' },
  });

  await emitEvent(taskId, 'status_change', { status: 'executing' });

  (async () => {
    try {
      const { executePPTGeneration } = await import('@/services/workflows/ppt-workflow');
      await executePPTGeneration(taskId, task.input);
    } catch (err) {
      const { failTask } = await import('@/services/task-manager');
      await failTask(taskId, err instanceof Error ? err.message : '执行失败');
    }
  })();

  return NextResponse.json({ success: true, status: 'executing' });
}

async function handleEmailApproval(
  taskId: string,
  task: { status: string; type: string }
) {
  if (task.type !== 'email') {
    return NextResponse.json(
      { error: '当前任务类型不支持邮件发送' },
      { status: 400 }
    );
  }

  if (task.status !== 'interacting') {
    return NextResponse.json(
      { error: '任务当前不在确认发送阶段' },
      { status: 400 }
    );
  }

  const context = await getTaskContext(taskId);
  const emailCtx = context.email as { draft: { subject: string; body: string } } | undefined;

  if (!emailCtx?.draft) {
    return NextResponse.json({ error: '未找到邮件草稿' }, { status: 400 });
  }

  const finalResult = {
    type: 'email',
    content: emailCtx.draft,
  };

  await completeTask(taskId, finalResult, '邮件已确认，可进入发送链路');
  await emitLog(taskId, '邮件已确认发送');

  return NextResponse.json({
    success: true,
    status: 'completed',
    email: emailCtx.draft,
  });
}
