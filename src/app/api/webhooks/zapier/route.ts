import { NextRequest, NextResponse } from 'next/server';
import { createTask, updateTaskType, updateTaskStatus, emitLog } from '@/services/task-manager';
import { routeTask } from '@/services/task-router';
import { getWorkflow } from '@/services/workflows';
import { TaskType } from '@/types/task';

import '@/services/workflows';

export async function GET() {
  // Zapier subscription verification
  return NextResponse.json({ status: 'ok', service: 'ORANGEBENCH' });
}

export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret if configured
    const secret = process.env.ZAPIER_WEBHOOK_SECRET;
    if (secret) {
      const provided = req.headers.get('x-webhook-secret');
      if (provided !== secret) {
        return NextResponse.json({ error: '无效的认证信息' }, { status: 401 });
      }
    }

    const body = await req.json();
    const { action, input, type, metadata } = body;

    if (action !== 'create_task') {
      return NextResponse.json(
        { error: `不支持的操作: ${action}` },
        { status: 400 }
      );
    }

    if (!input?.trim()) {
      return NextResponse.json({ error: '输入内容不能为空' }, { status: 400 });
    }

    // Create task from Zapier
    const task = await createTask(input.trim(), 'zapier');

    // Process in background
    (async () => {
      try {
        await updateTaskStatus(task.id, 'understanding');
        const routeResult = type && type !== 'unknown'
          ? { type: type as TaskType, title: input.slice(0, 50), confidence: 1 }
          : await routeTask(input);

        await updateTaskType(task.id, routeResult.type, routeResult.title);

        const workflow = getWorkflow(routeResult.type);
        if (workflow) {
          await workflow.start({
            taskId: task.id,
            input: input.trim(),
            context: metadata || {},
          });
        } else {
          const { failTask } = await import('@/services/task-manager');
          await failTask(task.id, `暂不支持 "${routeResult.type}" 类型的任务`);
        }
      } catch (err) {
        const { failTask } = await import('@/services/task-manager');
        await failTask(task.id, String(err));
      }
    })();

    return NextResponse.json(
      { taskId: task.id, status: 'accepted' },
      { status: 202 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: '处理 webhook 失败', detail: String(error) },
      { status: 500 }
    );
  }
}
