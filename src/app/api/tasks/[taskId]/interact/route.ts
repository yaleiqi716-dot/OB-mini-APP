import { NextRequest, NextResponse } from 'next/server';
import { getTask, getTaskContext, emitEvent } from '@/services/task-manager';
import { getWorkflow } from '@/services/workflows';
import { parseJSON } from '@/lib/utils';
import { InteractionSubmitRequest } from '@/types/api';
import { TaskType } from '@/types/task';

// Ensure workflows are registered
import '@/services/workflows';

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { taskId } = params;
    const body: InteractionSubmitRequest = await req.json();

    const task = await getTask(taskId);
    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    if (task.status !== 'interacting' && task.status !== 'structuring') {
      return NextResponse.json(
        { error: '任务当前不在交互状态' },
        { status: 400 }
      );
    }

    // Record the interaction response
    await emitEvent(taskId, 'interaction_response', {
      stepId: body.stepId,
      value: body.value,
    });

    // Get the workflow and handle the interaction
    const workflow = getWorkflow(task.type as TaskType);
    if (!workflow) {
      return NextResponse.json(
        { error: '未找到对应的工作流' },
        { status: 400 }
      );
    }

    const context = getTaskContext(taskId);

    // Process interaction in background
    workflow
      .handleInteraction(
        {
          taskId,
          input: task.input,
          context: parseJSON(task.context, {}),
        },
        body.stepId,
        body.value
      )
      .catch(console.error);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('提交交互失败:', error);
    return NextResponse.json(
      { error: '提交交互失败', detail: String(error) },
      { status: 500 }
    );
  }
}
