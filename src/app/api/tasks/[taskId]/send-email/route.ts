import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { completeTask, emitLog, getTaskContext } from '@/services/task-manager';

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { taskId } = params;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

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

    // Get the draft from context
    const context = await getTaskContext(taskId);
    const emailCtx = context.email as { draft: { subject: string; body: string } } | undefined;

    if (!emailCtx?.draft) {
      return NextResponse.json(
        { error: '未找到邮件草稿' },
        { status: 400 }
      );
    }

    const finalResult = {
      type: 'email',
      content: emailCtx.draft,
    };

    // Mark task as completed with the email content
    await completeTask(
      taskId,
      finalResult,
      '邮件已确认，可进入发送链路'
    );

    await emitLog(taskId, '邮件已确认发送');

    return NextResponse.json({
      success: true,
      status: 'completed',
      email: emailCtx.draft,
    });
  } catch (error) {
    return NextResponse.json(
      { error: '确认发送失败', detail: String(error) },
      { status: 500 }
    );
  }
}
