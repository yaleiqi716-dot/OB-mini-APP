import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/services/task-manager';

import '@/services/workflows';

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

    if (task.status !== 'structuring') {
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
  } catch (error) {
    return NextResponse.json(
      { error: '审批失败', detail: String(error) },
      { status: 500 }
    );
  }
}
