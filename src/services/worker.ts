import { updateTaskStatus, emitLog, emitThinking, updateTaskType, updateTaskContext, completeTask } from './task-manager';
import { routeAndPlan } from './agent-router';
import { getWorkflow } from './workflows';
import { checkCredits } from './billing';
import { estimateCost } from '@/lib/cost';
import { chatCompletion } from '@/lib/openrouter';
import { prisma } from '@/lib/prisma';
import { TaskType } from '@/types/task';

import './workflows';

// ---- Concurrency control ----

const MAX_CONCURRENT = 3;
const TASK_TIMEOUT_MS = 120_000;

let runningCount = 0;
let workerInterval: ReturnType<typeof setInterval> | null = null;

// ---- Atomic execution lock via updateMany ----

async function acquireLock(taskId: string): Promise<boolean> {
  // Atomic: only succeeds if isExecuting=false AND status=queued
  const result = await prisma.task.updateMany({
    where: { id: taskId, isExecuting: false, status: 'queued' },
    data: { isExecuting: true },
  });
  if (result.count === 0) {
    console.log(`[WORKER] Skipping task ${taskId} (already executing or not queued)`);
    return false;
  }
  return true;
}

async function releaseLock(taskId: string) {
  try {
    await prisma.task.update({ where: { id: taskId }, data: { isExecuting: false } });
  } catch (err) {
    console.error(`[WORKER] Failed to release lock for ${taskId}:`, err);
  }
}

// ---- Fetch next task from DB by priority ----

async function fetchNextQueuedTask() {
  // Fetch highest priority first, then oldest
  const task = await prisma.task.findFirst({
    where: { status: 'queued', isExecuting: false },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' },
    ],
  });
  return task;
}

// ---- Core execution ----

async function executeTask(taskId: string, input: string, presetType?: string, userId?: string) {
  await updateTaskStatus(taskId, 'understanding');
  await emitLog(taskId, '正在识别任务类型...');

  const plan = await routeAndPlan(input, presetType as TaskType | undefined);
  await updateTaskType(taskId, plan.taskType, plan.title);

  const cost = estimateCost(plan.taskType);
  await prisma.task.update({ where: { id: taskId }, data: { estimatedCost: cost } });
  await updateTaskContext(taskId, {
    executionStrategy: plan.strategy,
    model: plan.model,
  });

  if (userId) {
    const recheckResult = await checkCredits(userId, plan.taskType);
    if (!recheckResult.allowed) {
      const { failTask } = await import('./task-manager');
      await failTask(taskId, recheckResult.reason || '余额不足，请充值');
      return;
    }
  }

  await emitLog(taskId, `任务类型：${plan.taskType}`);

  if (plan.strategy === 'workflow') {
    const workflow = getWorkflow(plan.taskType);
    if (!workflow) {
      const { failTask } = await import('./task-manager');
      await failTask(taskId, `暂不支持 "${plan.taskType}" 类型的任务`);
      return;
    }
    await workflow.start({ taskId, input, context: {} });
  } else {
    await updateTaskStatus(taskId, 'executing');
    await emitThinking(taskId, '我来帮你处理这个请求...');

    const result = await chatCompletion(
      [
        {
          role: 'system',
          content: '你是一个专业的工作助手。根据用户需求直接给出完整、实用的回答。内容完整、专业、简洁。',
        },
        { role: 'user', content: input },
      ],
      { temperature: 0.6, maxTokens: 4096 }
    );

    await completeTask(taskId, { type: 'direct', content: result.content }, '已帮你完成');
  }
}

// ---- Process one task with lock + timeout + concurrency slot ----

async function processTask(task: { id: string; input: string; type: string; userId: string | null }) {
  const locked = await acquireLock(task.id);
  if (!locked) return;

  runningCount++;
  console.log(`[WORKER] Processing task ${task.id} (running: ${runningCount}/${MAX_CONCURRENT})`);

  try {
    await Promise.race([
      executeTask(task.id, task.input, task.type !== 'unknown' ? task.type : undefined, task.userId || undefined),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('任务执行超时，请重试')), TASK_TIMEOUT_MS)
      ),
    ]);
    console.log(`[WORKER] Completed task ${task.id}`);
  } catch (error) {
    console.error(`[WORKER] Failed task ${task.id}:`, error);
    try {
      const { failTask } = await import('./task-manager');
      await failTask(task.id, error instanceof Error ? error.message : '处理失败，请重试');
    } catch {}
  } finally {
    runningCount--;
    await releaseLock(task.id);
  }
}

// ---- Worker loop: poll DB, respect concurrency limit ----

async function workerLoop() {
  if (runningCount >= MAX_CONCURRENT) return;

  const task = await fetchNextQueuedTask();
  if (!task) return;

  // Fire and forget — don't await, so multiple tasks can run concurrently
  processTask(task).catch(() => {});
}

// ---- Recovery ----

async function recoverOrphanedTasks() {
  try {
    await prisma.task.updateMany({
      where: { processing: true },
      data: { processing: false },
    });
    await prisma.task.updateMany({
      where: { isExecuting: true },
      data: { isExecuting: false },
    });

    const queuedCount = await prisma.task.count({ where: { status: 'queued' } });
    if (queuedCount > 0) {
      console.log(`[WORKER] ${queuedCount} queued tasks found, will be picked up by polling`);
    }
  } catch (err) {
    console.error('[WORKER] Recovery failed:', err);
  }
}

// ---- Public API ----

export function startWorker(intervalMs = 1000) {
  if (workerInterval) return;
  console.log(`[WORKER] Started (polling every ${intervalMs}ms, max concurrent: ${MAX_CONCURRENT})`);

  recoverOrphanedTasks().catch(() => {});
  workerInterval = setInterval(workerLoop, intervalMs);
}

export function stopWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[WORKER] Stopped');
  }
}
