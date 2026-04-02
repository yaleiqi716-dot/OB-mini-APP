import { NextRequest, NextResponse } from 'next/server';
import { createTask, listTasks, formatTask, updateTaskStatus, emitLog } from '@/services/task-manager';
import { checkCredits, getOrCreateUser, checkUserConcurrency } from '@/services/billing';
import { startWorker } from '@/services/worker';
import { startAutoTaskRunner } from '@/services/auto-task-runner';
import { startScheduler } from '@/services/scheduler';
import { startMediaJobPoller } from '@/services/media-job-poller';
import { CreateTaskRequest } from '@/types/api';
import { prisma } from '@/lib/prisma';

import '@/services/workflows';

const PLAN_PRIORITY: Record<string, number> = {
  team: 3,
  pro: 2,
  basic: 1,
  free: 0,
};

// Start all background services on first import (server startup)
startWorker(1000);
startAutoTaskRunner(60_000);
startScheduler(60_000);
startMediaJobPoller(10_000);

// ---- Rate limiting ----

const lastSubmitByIp = new Map<string, number>();
const RATE_LIMIT_MS = 2000;
const ACTIVE_STATUSES = ['pending', 'queued', 'understanding', 'structuring', 'interacting', 'executing'];
const MAX_ACTIVE_TASKS = 20; // Preview mode: higher limit per user

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

    // If parentTaskId is provided, prepend original task's input as context
    let finalInput = body.input.trim();
    if (body.parentTaskId) {
      const parentTask = await prisma.task.findUnique({
        where: { id: body.parentTaskId },
        select: { input: true, title: true, result: true },
      });
      if (parentTask) {
        // 拼接父任务的 input + result，让 AI 能基于上次结果继续
        // result 在 DB 中存储为 JSON 字符串，需要先 parse 再取 .content
        let parentResult: string | null = null;
        if (parentTask.result) {
          try {
            const parsed = JSON.parse(parentTask.result as string);
            if (typeof parsed.content === 'string') {
              parentResult = parsed.content;
            } else if (typeof parsed === 'string') {
              parentResult = parsed;
            } else {
              parentResult = JSON.stringify(parsed);
            }
          } catch {
            // 如果不是 JSON，直接使用原始字符串
            parentResult = parentTask.result as string;
          }
        }
        if (parentResult) {
          finalInput = `【上一次任务】${parentTask.title || parentTask.input}\n\n【上一次结果】\n${parentResult}\n\n【当前指令】${finalInput}`;
        } else {
          finalInput = `【原始任务】${parentTask.title || ''}\n${parentTask.input}\n\n【当前指令】${finalInput}`;
        }
      }
    }

    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    const estimatedType = body.type || 'unknown';
    const creditCheck = await checkCredits(userId, estimatedType);
    if (!creditCheck.allowed) {
      return NextResponse.json({ error: creditCheck.reason }, { status: 403 });
    }

    // Per-user active task limit (not global)
    const userActiveTasks = await prisma.task.count({ where: { userId, status: { in: ACTIVE_STATUSES } } });
    if (userActiveTasks >= MAX_ACTIVE_TASKS) {
      return NextResponse.json({ error: '你有太多任务正在运行，请等待完成后再提交' }, { status: 429 });
    }

    // Per-user concurrency
    const canRun = await checkUserConcurrency(userId);
    if (!canRun) {
      return NextResponse.json({ error: '你有任务正在执行中，请等待完成后再提交' }, { status: 429 });
    }

    // Determine priority from user plan
    const user = await getOrCreateUser(userId);
    const priority = PLAN_PRIORITY[user.plan] || 0;

    // Create task — always assign to current user so it appears in /tasks/mine and dashboard stats
    // 处理 conversationId：如果前端传了就用，否则自动创建新会话
    let conversationId: string | null = body.conversationId || null;
    if (!conversationId) {
      const conv = await prisma.conversation.create({
        data: { userId, title: null },
      });
      conversationId = conv.id;
    } else {
      const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
      if (!conv || conv.userId !== userId) {
        return NextResponse.json({ error: '会话不存在' }, { status: 404 });
      }
    }

    const task = await createTask(finalInput, body.source || 'agent', {
      userId,
      estimatedCost: creditCheck.estimatedCost,
      assigneeId: body.assigneeId || userId,
    });

    // Set priority + move to queued (worker polls DB by priority)
    await prisma.task.update({ where: { id: task.id }, data: { priority, conversationId } });
    // Update conversation updatedAt
    await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    await updateTaskStatus(task.id, 'queued');
    await emitLog(task.id, '任务已提交，排队中...');

    return NextResponse.json({ taskId: task.id, type: task.type, status: 'queued', conversationId });
  } catch (error) {
    console.error('[TASK_CREATE_ERROR]', error);
    return NextResponse.json({ error: '创建任务失败，请重试' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value;
    if (userId) {
      const tasks = await prisma.task.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          events: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      return NextResponse.json(tasks.map(formatTask));
    }
    const tasks = await listTasks(50);
    return NextResponse.json(tasks.map(formatTask));
  } catch (error) {
    console.error('[TASK_LIST_ERROR]', error);
    return NextResponse.json({ error: '获取任务列表失败' }, { status: 500 });
  }
}
