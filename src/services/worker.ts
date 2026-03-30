import { dequeue, getQueueLength } from './task-queue';
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

async function processQueueItem() {
  const item = dequeue();
  if (!item) return;

  const { taskId, input, presetType, userId } = item;
  console.log(`[WORKER] Processing task ${taskId}`);

  try {
    // Move from queued → understanding
    await updateTaskStatus(taskId, 'understanding');
    await emitLog(taskId, '正在识别任务类型...');

    // Route and plan
    const plan = await routeAndPlan(input, presetType as TaskType | undefined);
    await updateTaskType(taskId, plan.taskType, plan.title);

    // Update cost + dispatch info
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
        const { failTask } = await import('./task-manager');
        await failTask(taskId, recheckResult.reason || '余额不足，请充值');
        return;
      }
    }

    await emitLog(taskId, `任务类型：${plan.taskType}`);

    // Dispatch
    if (plan.strategy === 'workflow') {
      const workflow = getWorkflow(plan.taskType);
      if (!workflow) {
        const { failTask } = await import('./task-manager');
        await failTask(taskId, `暂不支持 "${plan.taskType}" 类型的任务`);
        return;
      }
      await workflow.start({ taskId, input, context: {} });
    } else {
      // Direct mode
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

    console.log(`[WORKER] Completed task ${taskId}`);
  } catch (error) {
    console.error(`[WORKER] Failed task ${taskId}:`, error);
    try {
      const { failTask } = await import('./task-manager');
      await failTask(taskId, error instanceof Error ? error.message : '处理失败，请重试');
    } catch {}
  }
}

async function workerLoop() {
  if (workerRunning) return; // Prevent concurrent runs
  if (getQueueLength() === 0) return;

  workerRunning = true;
  try {
    await processQueueItem();
  } finally {
    workerRunning = false;
  }
}

export function startWorker(intervalMs = 1000) {
  if (workerInterval) return; // Already started
  console.log('[WORKER] Started (polling every', intervalMs, 'ms)');
  workerInterval = setInterval(workerLoop, intervalMs);
}

export function stopWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[WORKER] Stopped');
  }
}
