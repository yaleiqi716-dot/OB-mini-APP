import { NextRequest, NextResponse } from 'next/server';
import {
  createTask, listTasks, formatTask, updateTaskType, updateTaskStatus,
  updateTaskContext, completeTask, emitLog, emitThinking,
} from '@/services/task-manager';
import { routeAndPlan } from '@/services/agent-router';
import { getWorkflow } from '@/services/workflows';
import { checkCredits } from '@/services/billing';
import { estimateCost } from '@/lib/cost';
import { chatCompletion } from '@/lib/openrouter';
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

    const now = Date.now();
    const lastSubmit = lastSubmitByIp.get(ip) || 0;
    if (now - lastSubmit < RATE_LIMIT_MS) {
      return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
    }
    lastSubmitByIp.set(ip, now);

    const body: CreateTaskRequest = await req.json();
    if (!body.input?.trim()) {
      return NextResponse.json({ error: '请输入任务内容' }, { status: 400 });
    }

    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value || 'demo-user';
    const estimatedType = body.type || 'unknown';
    const creditCheck = await checkCredits(userId, estimatedType);
    if (!creditCheck.allowed) {
      return NextResponse.json({ error: creditCheck.reason }, { status: 403 });
    }

    const activeTasks = await prisma.task.count({ where: { status: { in: ACTIVE_STATUSES } } });
    if (activeTasks >= MAX_ACTIVE_TASKS) {
      return NextResponse.json({ error: '当前有任务正在执行，请稍后再试' }, { status: 429 });
    }

    const task = await createTask(body.input.trim(), body.source || 'agent', {
      userId,
      estimatedCost: creditCheck.estimatedCost,
    });

    processTask(task.id, body.input.trim(), body.type, userId).catch((err) => {
      console.error('[TASK_PROCESS_ERROR]', task.id, err);
    });

    return NextResponse.json({ taskId: task.id, type: task.type, status: task.status });
  } catch (error) {
    console.error('[TASK_CREATE_ERROR]', error);
    return NextResponse.json({ error: '创建任务失败，请重试' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const tasks = await listTasks(50);
    return NextResponse.json(tasks.map(formatTask));
  } catch (error) {
    console.error('[TASK_LIST_ERROR]', error);
    return NextResponse.json({ error: '获取任务列表失败' }, { status: 500 });
  }
}

async function processTask(taskId: string, input: string, presetType?: TaskType, userId?: string) {
  try {
    await updateTaskStatus(taskId, 'understanding');
    await emitLog(taskId, '正在识别任务类型...');

    // ---- Agent Router: classify → plan ----
    const plan = await routeAndPlan(input, presetType);
    await updateTaskType(taskId, plan.taskType, plan.title);

    // Update estimated cost + dispatch info in context
    const cost = estimateCost(plan.taskType);
    await prisma.task.update({ where: { id: taskId }, data: { estimatedCost: cost } });
    await updateTaskContext(taskId, {
      executionStrategy: plan.strategy,
      model: plan.model,
    });

    // Re-check credits with actual type
    if (userId) {
      const recheckResult = await checkCredits(userId, plan.taskType);
      if (!recheckResult.allowed) {
        const { failTask } = await import('@/services/task-manager');
        await failTask(taskId, recheckResult.reason || '余额不足，请充值');
        return;
      }
    }

    await emitLog(taskId, `任务类型：${plan.taskType}`);

    // ---- Execution Dispatch ----
    if (plan.strategy === 'workflow') {
      const workflow = getWorkflow(plan.taskType);
      if (!workflow) {
        const { failTask } = await import('@/services/task-manager');
        await failTask(taskId, `暂不支持 "${plan.taskType}" 类型的任务`);
        return;
      }
      await workflow.start({ taskId, input, context: {} });
    } else {
      // Direct execution — lightweight single-call for unknown/unsupported types
      await executeDirectMode(taskId, input, plan.model);
    }
  } catch (error) {
    console.error('[WORKFLOW_ERROR]', taskId, error);
    const { failTask } = await import('@/services/task-manager');
    await failTask(taskId, error instanceof Error ? error.message : '处理失败，请重试');
  }
}

// ---- Direct Execution Mode ----
// Single LLM call → result → complete. No multi-step workflow.

async function executeDirectMode(taskId: string, input: string, model: string) {
  await updateTaskStatus(taskId, 'executing');
  await emitThinking(taskId, '我来帮你处理这个请求...');
  await emitLog(taskId, '直接处理中...');

  const result = await chatCompletion(
    [
      {
        role: 'system',
        content: `你是一个专业的工作助手。根据用户需求直接给出完整、实用的回答。

要求：
- 内容完整、可直接使用
- 专业、简洁
- 如果是分析类，给出结构化分析
- 如果是创作类，给出完整内容`,
      },
      { role: 'user', content: input },
    ],
    { temperature: 0.6, maxTokens: 4096 }
  );

  await completeTask(
    taskId,
    { type: 'direct', content: result.content },
    '已帮你完成'
  );
}
