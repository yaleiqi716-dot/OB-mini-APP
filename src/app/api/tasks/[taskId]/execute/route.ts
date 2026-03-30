import { NextRequest, NextResponse } from 'next/server';
import { getTask, updateTaskStatus, emitLog } from '@/services/task-manager';
import { getWorkflow } from '@/services/workflows';
import { parseJSON } from '@/lib/utils';
import { TaskType } from '@/types/task';

import '@/services/workflows';

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { taskId } = params;
    const task = await getTask(taskId);

    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    const workflow = getWorkflow(task.type as TaskType);
    if (!workflow) {
      return NextResponse.json({ error: '未找到工作流' }, { status: 400 });
    }

    // Restart workflow execution
    workflow
      .start({
        taskId,
        input: task.input,
        context: parseJSON(task.context, {}),
      })
      .catch(console.error);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '执行失败' }, { status: 500 });
  }
}
