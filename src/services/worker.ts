import { updateTaskStatus, emitLog, emitThinking, emitEvent, updateTaskType, updateTaskContext, completeTask, requestInteraction } from './task-manager';
import { checkUserConcurrency, executeWithBilling, InsufficientCreditsError } from './billing';
import { estimateCost } from '@/lib/cost';
import { prisma } from '@/lib/prisma';
import { TaskType } from '@/types/task';
import { routeIntent } from './agent/router';
import { dispatch, ASYNC_INTENTS } from './agent/dispatch';

// ---- Concurrency control ----

const MAX_CONCURRENT = 3;
const TASK_TIMEOUT_MS = 30_000; // 30s — async tools return immediately, no need for 120s

let runningCount = 0;
let workerInterval: ReturnType<typeof setInterval> | null = null;

// ---- Atomic execution lock ----

async function acquireLock(taskId: string): Promise<boolean> {
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

async function fetchNextQueuedTask() {
  return prisma.task.findFirst({
    where: { status: 'queued', isExecuting: false },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });
}

// ---- Single execution chain: Router → Dispatch → Tool ----

async function executeTask(taskId: string, input: string) {
  await updateTaskStatus(taskId, 'understanding');
  await emitLog(taskId, '正在分析任务...');
  await emitThinking(taskId, '我先帮你拆解一下需求...');

  // Step 1: Router — ChatGPT decides intent
  const decision = await routeIntent(input);

  await updateTaskContext(taskId, {
    agentIntent: decision.intent,
    agentReason: decision.reason,
  });

  console.log(`[WORKER] Task ${taskId} routed: intent=${decision.intent}, needsClarification=${decision.needsClarification}`);

  // Step 2: Clarification needed → ask user
  if (decision.needsClarification && decision.questions.length > 0) {
    await requestInteraction(taskId, {
      id: `clarify_${Date.now()}`,
      taskId,
      stepId: 'agent_clarification',
      type: 'text_input',
      question: decision.questions.join('\n'),
      placeholder: '请补充以上信息',
    });
    return;
  }

  // Step 3: Dispatch — all intents go through dispatch, no exceptions
  const intentType = decision.intent;
  const cost = estimateCost(intentType);
  await prisma.task.update({ where: { id: taskId }, data: { estimatedCost: cost } });

  const title = input.slice(0, 50);
  await updateTaskType(taskId, 'unknown' as TaskType, title);
  await updateTaskContext(taskId, { executionStrategy: 'agent_dispatch', engine: intentType });
  await emitLog(taskId, `执行方式：${intentType}`);
  await updateTaskStatus(taskId, 'executing');
  await emitThinking(taskId, '正在执行任务...');

  const result = await dispatch(decision, input);

  if (!result.success) {
    const { failTask } = await import('./task-manager');
    await failTask(taskId, result.message || '执行失败');
    return;
  }

  // Step 4: Check if async (image/video/avatar_video/browser_task)
  const isAsync = ASYNC_INTENTS.has(intentType) && result.data._async;

  if (isAsync) {
    // Store jobId on task — media-job-poller will pick it up
    const jobId = String(result.data.jobId || '');
    await prisma.task.update({
      where: { id: taskId },
      data: {
        externalJobId: jobId,
        externalEngine: result.engine,
      },
    });
    await emitLog(taskId, result.message);
    // Task stays in "executing" — poller will complete it
    console.log(`[WORKER] Task ${taskId} async job created: ${result.engine}/${jobId}`);
    return;
  }

  // Synchronous result — complete immediately
  await completeTask(taskId, result.data, result.message);
}

// ---- Process one task ----

async function processTask(task: { id: string; input: string; type: string; userId: string | null }) {
  if (task.userId) {
    const canRun = await checkUserConcurrency(task.userId);
    if (!canRun) {
      console.log(`[WORKER] Skipping task ${task.id} (user ${task.userId} at concurrency limit)`);
      return;
    }
  }

  const locked = await acquireLock(task.id);
  if (!locked) return;

  runningCount++;
  console.log(`[WORKER] Processing task ${task.id} (running: ${runningCount}/${MAX_CONCURRENT})`);

  try {
    if (!task.userId) {
      const { failTask } = await import('./task-manager');
      await failTask(task.id, '任务缺少用户信息，无法执行');
      return;
    }

    const executeFn = async () => {
      await executeTask(task.id, task.input);
    };

    try {
      await Promise.race([
        executeWithBilling(task.userId, task.id, task.type, executeFn),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('任务执行超时，请重试')), TASK_TIMEOUT_MS)
        ),
      ]);
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        await prisma.task.update({
          where: { id: task.id },
          data: { status: 'blocked', errorMessage: err.message },
        });
        await emitEvent(task.id, 'payment_required', {
          required: err.required,
          current: err.current,
        });
        await emitEvent(task.id, 'status_change', { status: 'blocked' });
        return;
      }
      throw err;
    }

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

// ---- Worker loop ----

async function workerLoop() {
  if (runningCount >= MAX_CONCURRENT) return;
  const task = await fetchNextQueuedTask();
  if (!task) return;
  processTask(task).catch(() => {});
}

// ---- Recovery ----

async function recoverOrphanedTasks() {
  try {
    await prisma.task.updateMany({ where: { processing: true }, data: { processing: false } });
    await prisma.task.updateMany({ where: { isExecuting: true }, data: { isExecuting: false } });
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
