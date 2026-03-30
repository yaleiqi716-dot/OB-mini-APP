import { NextRequest, NextResponse } from 'next/server';
import { createTask, listTasks, formatTask, updateTaskStatus, emitLog } from '@/services/task-manager';
import { checkCredits, getOrCreateUser, checkUserConcurrency } from '@/services/billing';
import { startWorker } from '@/services/worker';
import { CreateTaskRequest } from '@/types/api';
import { prisma } from '@/lib/prisma';

import '@/services/workflows';

const PLAN_PRIORITY: Record<string, number> = {
  team: 3,
  pro: 2,
  basic: 1,
  free: 0,
};

// Start worker on first import (server startup)
startWorker(1000);

// ---- Rate limiting ----

const lastSubmitByIp = new Map<string, number>();
const RATE_LIMIT_MS = 2000;
const ACTIVE_STATUSES = ['pending', 'queued', 'understanding', 'structuring', 'interacting', 'executing'];
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
      return NextResponse.json({ error: '系统繁忙，请稍后再试' }, { status: 429 });
    }

    // Per-user concurrency
    const canRun = await checkUserConcurrency(userId);
    if (!canRun) {
      return NextResponse.json({ error: '你有任务正在执行中，请等待完成后再提交' }, { status: 429 });
    }

    // Determine priority from user plan
    const user = await getOrCreateUser(userId);
    const priority = PLAN_PRIORITY[user.plan] || 0;

    // Create task with priority
    const task = await createTask(body.input.trim(), body.source || 'agent', {
      userId,
      estimatedCost: creditCheck.estimatedCost,
    });

    // Set priority + move to queued (worker polls DB by priority)
    await prisma.task.update({ where: { id: task.id }, data: { priority } });
    await updateTaskStatus(task.id, 'queued');
    await emitLog(task.id, '任务已提交，排队中...');

    return NextResponse.json({ taskId: task.id, type: task.type, status: 'queued' });
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
