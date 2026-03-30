import { dequeue, enqueue, getQueueLength } from './task-queue';
import { updateTaskStatus, emitLog, emitThinking, updateTaskType, updateTaskContext, completeTask } from './task-manager';
import { routeAndPlan } from './agent-router';
import { getWorkflow } from './workflows';
import { checkCredits } from './billing';
import { estimateCost } from '@/lib/cost';
import { chatCompletion } from '@/lib/openrouter';
import { prisma } from '@/lib/prisma';
import { TaskType } from '@/types/task';

import './workflows';

let workerRunning = false;
let workerInterval: ReturnType<typeof setInterval> | null = null;
const TASK_TIMEOUT_MS = 120_000; // 2 minutes

// ---- Execution lock helpers ----

async function acquireLock(taskId: string): Promise<boolean> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.processing) {
    console.log(`[WORKER] Skipping task ${taskId} (${!task ? 'not found' : 'already processing'})`);
    return false;
  }
  await prisma.task.update({ where: { id: taskId }, data: { processing: true } });
  return true;
}

async function releaseLock(taskId: string) {
  try {
    await prisma.task.update({ where: { id: taskId }, data: { processing: false } });
  } catch (err) {
    console.error(`[WORKER] Failed to release lock for ${taskId}:`, err);
  }
}

// ---- Core execution (wrapped with timeout) ----

async function executeTask(taskId: string, input: string, presetType?: string, userId?: string) {
  // Move from queued → understanding
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

// ---- Process one queue item with lock + timeout ----

async function processQueueItem() {
  const item = dequeue();
  if (!item) return;

  const { taskId, input, presetType, userId } = item;

  // Acquire execution lock
  const locked = await acquireLock(taskId);
  if (!locked) return;

  console.log(`[WORKER] Processing task ${taskId}`);

  try {
    // Execute with timeout
    await Promise.race([
      executeTask(taskId, input, presetType, userId),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('任务执行超时，请重试')), TASK_TIMEOUT_MS)
      ),
    ]);

    console.log(`[WORKER] Completed task ${taskId}`);
  } catch (error) {
    console.error(`[WORKER] Failed task ${taskId}:`, error);
    try {
      const { failTask } = await import('./task-manager');
      await failTask(taskId, error instanceof Error ? error.message : '处理失败，请重试');
    } catch (failErr) {
      console.error(`[WORKER] failTask also failed for ${taskId}:`, failErr);
    }
  } finally {
    // Always release lock
    await releaseLock(taskId);
  }
}

// ---- Worker loop ----

async function workerLoop() {
  if (workerRunning) return;
  if (getQueueLength() === 0) return;

  workerRunning = true;
  try {
    await processQueueItem();
  } finally {
    workerRunning = false;
  }
}

// ---- Recovery: re-enqueue orphaned tasks on startup ----

async function recoverOrphanedTasks() {
  try {
    // Reset any stuck processing flags
    await prisma.task.updateMany({
      where: { processing: true },
      data: { processing: false },
    });

    // Re-enqueue tasks that are still queued
    const queuedTasks = await prisma.task.findMany({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
    });

    for (const task of queuedTasks) {
      enqueue({
        taskId: task.id,
        input: task.input,
        presetType: task.type !== 'unknown' ? task.type : undefined,
        userId: task.userId || undefined,
        enqueuedAt: Date.now(),
      });
    }

    if (queuedTasks.length > 0) {
      console.log(`[WORKER] Recovered ${queuedTasks.length} orphaned tasks`);
    }
  } catch (err) {
    console.error('[WORKER] Recovery failed:', err);
  }
}

// ---- Public API ----

export function startWorker(intervalMs = 1000) {
  if (workerInterval) return;
  console.log('[WORKER] Started (polling every', intervalMs, 'ms)');

  // Recover orphaned tasks from previous run
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
