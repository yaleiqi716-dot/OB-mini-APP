import { NextRequest, NextResponse } from 'next/server';
import { createTask, listTasks, formatTask, updateTaskType, updateTaskStatus, emitLog } from '@/services/task-manager';
import { routeTask } from '@/services/task-router';
import { getWorkflow } from '@/services/workflows';
import { CreateTaskRequest } from '@/types/api';
import { TaskType } from '@/types/task';
import { prisma } from '@/lib/prisma';

import '@/services/workflows';

// ---- Rate limiting (in-memory, per-process) ----

const lastSubmitByIp = new Map<string, number>();
const RATE_LIMIT_MS = 2000;

const ACTIVE_STATUSES = ['pending', 'understanding', 'structuring', 'interacting', 'executing'];
const MAX_ACTIVE_TASKS = 5;

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // Rate limit: 1 request per 2s per IP
    const now = Date.now();
    const lastSubmit = lastSubmitByIp.get(ip) || 0;
    if (now - lastSubmit < RATE_LIMIT_MS) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试' },
        { status: 429 }
      );
    }
    lastSubmitByIp.set(ip, now);

    const body: CreateTaskRequest = await req.json();

    if (!body.input?.trim()) {
      return NextResponse.json({ error: '请输入任务内容' }, { status: 400 });
    }

    // Concurrency limit: max active tasks
    const activeTasks = await prisma.task.count({
      where: { status: { in: ACTIVE_STATUSES } },
    });
    if (activeTasks >= MAX_ACTIVE_TASKS) {
      return NextResponse.json(
        { error: '当前有任务正在执行，请稍后再试' },
        { status: 429 }
      );
    }

    const task = await createTask(body.input.trim(), body.source || 'agent');

    processTask(task.id, body.input.trim(), body.type).catch((err) => {
      console.error('[TASK_PROCESS_ERROR]', task.id, err);
    });

    return NextResponse.json({
      taskId: task.id,
      type: task.type,
      status: task.status,
    });
  } catch (error) {
    console.error('[TASK_CREATE_ERROR]', error);
    return NextResponse.json(
      { error: '创建任务失败，请重试' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const tasks = await listTasks(50);
    const formatted = tasks.map(formatTask);
    return NextResponse.json(formatted);
  } catch (error) {
    console.error('[TASK_LIST_ERROR]', error);
    return NextResponse.json({ error: '获取任务列表失败' }, { status: 500 });
  }
}

async function processTask(taskId: string, input: string, presetType?: TaskType) {
  try {
    await updateTaskStatus(taskId, 'understanding');
    await emitLog(taskId, '正在识别任务类型...');

    let taskType: TaskType;
    let title: string;

    if (presetType && presetType !== 'unknown') {
      taskType = presetType;
      title = input.slice(0, 50);
    } else {
      const routeResult = await routeTask(input);
      taskType = routeResult.type;
      title = routeResult.title;
    }

    await updateTaskType(taskId, taskType, title);
    await emitLog(taskId, `任务类型：${taskType}`);

    const workflow = getWorkflow(taskType);
    if (!workflow) {
      await emitLog(taskId, '暂不支持此类型的任务');
      const { failTask } = await import('@/services/task-manager');
      await failTask(taskId, `暂不支持 "${taskType}" 类型的任务`);
      return;
    }

    await workflow.start({ taskId, input, context: {} });
  } catch (error) {
    console.error('[WORKFLOW_ERROR]', taskId, error);
    const { failTask } = await import('@/services/task-manager');
    await failTask(taskId, error instanceof Error ? error.message : '处理失败，请重试');
  }
}
