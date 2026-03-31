import { createTask, updateTaskStatus, emitLog, emitThinking, emitEvent, updateTaskType, updateTaskContext, completeTask } from './task-manager';
import { routeAndPlan } from './agent-router';
import { planTasks } from './agent-planner';
import { getWorkflow } from './workflows';
import { checkCredits, checkUserConcurrency, executeWithBilling, InsufficientCreditsError } from './billing';
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
  await emitLog(taskId, '正在分析任务...');
  await emitThinking(taskId, '我先帮你拆解一下需求...');

  // Use planner for open-ended input, routeAndPlan for preset types
  if (!presetType || presetType === 'unknown') {
    const agentPlan = await planTasks(input);

    if (agentPlan.tasks.length > 1) {
      // Two tasks — create sub-tasks directly
      await emitLog(taskId, `拆解为 ${agentPlan.tasks.length} 个子任务`);
      await updateTaskContext(taskId, { subtasks: agentPlan.tasks.map((t) => t.type) });

      const subTaskIds: string[] = [];
      for (const sub of agentPlan.tasks) {
        const subTask = await createTask(sub.input, 'api', {
          userId: userId || undefined,
          estimatedCost: estimateCost(sub.type),
        });
        await prisma.task.update({
          where: { id: subTask.id },
          data: { type: sub.type, title: sub.input.slice(0, 50), priority: 0 },
        });
        await updateTaskStatus(subTask.id, 'queued');
        await emitLog(subTask.id, `子任务：${sub.type}`);
        subTaskIds.push(subTask.id);
      }

      await completeTask(taskId, {
        type: 'orchestrator',
        subtasks: subTaskIds,
        plan: agentPlan.tasks,
      }, `已拆解为 ${subTaskIds.length} 个子任务并开始执行`);
      return;
    }

    // Single task from planner — route it
    presetType = agentPlan.tasks[0].type;
    // Use planner's refined input if different
    if (agentPlan.tasks[0].input !== input) {
      input = agentPlan.tasks[0].input;
    }
  }

  // Single task execution (existing flow)
  const plan = await routeAndPlan(input, presetType as TaskType | undefined);
  await updateTaskType(taskId, plan.taskType, plan.title);

  const cost = estimateCost(plan.taskType);
  await prisma.task.update({ where: { id: taskId }, data: { estimatedCost: cost } });
  await updateTaskContext(taskId, {
    executionStrategy: plan.strategy,
    model: plan.model,
  });

  await emitLog(taskId, `任务类型：${plan.taskType}`);

  // ---- Unified billing gateway: charge first, then execute ----
  const executeFn = async () => {
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
          { role: 'system', content: '你是一个专业的工作助手。根据用户需求直接给出完整、实用的回答。内容完整、专业、简洁。' },
          { role: 'user', content: input },
        ],
        { temperature: 0.6, maxTokens: 4096 }
      );
      await completeTask(taskId, { type: 'direct', content: result.content }, '已帮你完成');
    }
  };

  if (!userId) {
    const { failTask } = await import('./task-manager');
    await failTask(taskId, '任务缺少用户信息，无法执行');
    return;
  }
  try {
    await executeWithBilling(userId, taskId, plan.taskType, executeFn);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: 'blocked', errorMessage: err.message },
      });
      await emitEvent(taskId, 'payment_required', {
        required: err.required,
        current: err.current,
      });
      await emitEvent(taskId, 'status_change', { status: 'blocked' });
      return;
    }
    throw err;
  }
}

// ---- Process one task with lock + timeout + concurrency slot ----

async function processTask(task: { id: string; input: string; type: string; userId: string | null }) {
  // Per-user concurrency check
  if (task.userId) {
    const canRun = await checkUserConcurrency(task.userId);
    if (!canRun) {
      console.log(`[WORKER] Skipping task ${task.id} (user ${task.userId} at concurrency limit)`);
      return; // Will be retried next poll
    }
  }

  const locked = await acquireLock(task.id);
  if (!locked) return;

  // Credits charged inside executeWithBilling (within executeTask)
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
