import { NextRequest, NextResponse } from 'next/server';
import { createTask, updateTaskType, updateTaskStatus, emitLog } from '@/services/task-manager';
import { routeTask } from '@/services/task-router';
import { getWorkflow } from '@/services/workflows';
import { eventToTaskInput } from '@/services/integrations/event-to-task';
import { TaskSource } from '@/types/task';

import '@/services/workflows';

export async function POST(req: NextRequest) {
  try {
    // Webhook secret verification
    const secret = process.env.WEBHOOK_SECRET;
    if (secret) {
      const provided = req.headers.get('x-ob-secret');
      if (provided !== secret) {
        return NextResponse.json({ error: '认证失败' }, { status: 401 });
      }
    }

    const body = await req.json();
    const { source, eventType, userId, spaceId, title, payload } = body;

    if (!eventType || !payload) {
      return NextResponse.json(
        { error: '缺少必填字段：eventType, payload' },
        { status: 400 }
      );
    }

    // Convert external event to natural language task input
    const taskInput = eventToTaskInput({
      source: source || 'webhook',
      eventType,
      title,
      payload,
    });

    // Determine task source
    const taskSource: TaskSource = source === 'zapier' ? 'zapier' : 'api';

    // Create task
    const task = await createTask(taskInput, taskSource);

    // Process in background (same pipeline as agent tasks)
    (async () => {
      try {
        await updateTaskStatus(task.id, 'understanding');
        await emitLog(task.id, `外部事件：${eventType}`);

        const routeResult = await routeTask(taskInput);
        await updateTaskType(task.id, routeResult.type, title || routeResult.title);
        await emitLog(task.id, `任务类型：${routeResult.type}`);

        const workflow = getWorkflow(routeResult.type);
        if (workflow) {
          await workflow.start({ taskId: task.id, input: taskInput, context: {} });
        } else {
          const { failTask } = await import('@/services/task-manager');
          await failTask(task.id, `暂不支持 "${routeResult.type}" 类型的任务`);
        }
      } catch (err) {
        const { failTask } = await import('@/services/task-manager');
        await failTask(task.id, err instanceof Error ? err.message : '处理外部事件失败');
      }
    })();

    return NextResponse.json(
      { success: true, taskId: task.id },
      { status: 202 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: '处理事件失败', detail: String(error) },
      { status: 500 }
    );
  }
}
