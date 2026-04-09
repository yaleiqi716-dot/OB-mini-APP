import { updateTaskStatus, emitLog, emitThinking, emitEvent, updateTaskType, updateTaskContext, completeTask, requestInteraction } from './task-manager';
import { checkUserConcurrency, executeWithBilling, InsufficientCreditsError } from './billing';
import { estimateCost } from '@/lib/cost';
import { prisma } from '@/lib/prisma';
import { TaskType } from '@/types/task';
import { routeIntent } from './agent/router';
import { dispatch, ASYNC_INTENTS } from './agent/dispatch';

// ---- Concurrency control ----

const MAX_CONCURRENT = 3;
const TASK_TIMEOUT_MS = 180_000; // 180s — Router + LLM can take 60-150s

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

// ---- Step event helpers ----

async function emitStepStarted(taskId: string, stepId: string, label: string, detail?: string) {
  return emitEvent(taskId, 'step_update', {
    stepId,
    label,
    detail: detail || '',
    status: 'running',
  });
}

async function emitStepCompleted(taskId: string, stepId: string, label: string, note?: string) {
  return emitEvent(taskId, 'step_complete', {
    stepId,
    label,
    status: 'done',
    note: note || '',
  });
}

async function emitStepFailed(taskId: string, stepId: string, label: string, reason: string, retryable = true) {
  return emitEvent(taskId, 'step_update', {
    stepId,
    label,
    status: 'retrying',
    note: reason,
    retryable,
  });
}

// ---- Intent → human-readable step label ----

function intentToStepLabel(intent: string): { label: string; detail: string } {
  const map: Record<string, { label: string; detail: string }> = {
    text:         { label: '生成内容',       detail: '调用语言模型，根据需求生成完整输出' },
    search:       { label: '搜索并整理',     detail: '联网获取最新信息，提炼关键内容' },
    image:        { label: '生成图片',       detail: '将描述转化为视觉图像' },
    video:        { label: '生成视频',       detail: '合成视频内容，可能需要几分钟' },
    avatar_video: { label: '生成数字人视频', detail: '克隆形象并合成口播视频' },
    automation:   { label: '触发自动化',     detail: '调用外部系统执行操作' },
    browser_task: { label: '浏览器操作',     detail: '打开页面，执行网页交互任务' },
  };
  return map[intent] || { label: '处理任务', detail: '执行中...' };
}

// ---- Single execution chain: Router → Dispatch → Tool ----

async function executeTask(taskId: string, input: string) {
  // ── Step 1: 理解需求 ──────────────────────────────────────────────────────
  await updateTaskStatus(taskId, 'understanding');
  await emitStepStarted(taskId, 'step_understand', '理解需求', '分析你的输入，判断任务类型和执行方向');
  await emitThinking(taskId, '先看看你要做什么...');

  let decision;
  try {
    decision = await routeIntent(input);
  } catch (err) {
    await emitStepFailed(taskId, 'step_understand', '理解需求', '路由分析失败，使用默认文本处理', true);
    decision = {
      intent: 'text' as const,
      reason: '默认文本处理',
      needsClarification: false,
      questions: [],
      toolPayload: { prompt: input },
    };
  }

  await updateTaskContext(taskId, {
    agentIntent: decision.intent,
    agentReason: decision.reason,
  });

  // Emit real thinking from LLM reason
  if (decision.reason) {
    await emitThinking(taskId, decision.reason);
  }

  await emitStepCompleted(taskId, 'step_understand', '理解需求', `决定使用：${intentToStepLabel(decision.intent).label}`);

  console.log(`[WORKER] Task ${taskId} routed: intent=${decision.intent}`);

  // ── Step 2: 规划执行 ──────────────────────────────────────────────────────
  const intentType = decision.intent;
  const { label: execLabel, detail: execDetail } = intentToStepLabel(intentType);
  const cost = estimateCost(intentType);

  await prisma.task.update({ where: { id: taskId }, data: { estimatedCost: cost } });
  // Strip preambles when deriving the task title. The task.input may have
  // been injected in two ways:
  //   1. Skill role preamble from /api/tasks:
  //        【AI 同事角色】<name>\n...\n---\n\n【用户任务】<real input>
  //   2. Workspace task preamble from /api/workspace/tasks/[id]/agent:
  //        【工作区任务】<title>\n【任务描述】...\n【当前指令】请根据以上任务要求执行
  //   3. Both combined (role + workspace):
  //        【AI 同事角色】<name>\n...\n---\n\n【用户任务】【工作区任务】<title>\n...
  //
  // Strategy: prefer 【工作区任务】 when present (pulls clean task title
  // directly), else fall back to 【用户任务】, else use the raw input.
  const WS_TASK_MARKER = '【工作区任务】';
  const USER_INTENT_MARKER = '【用户任务】';
  let title: string;
  const wsIdx = input.indexOf(WS_TASK_MARKER);
  if (wsIdx >= 0) {
    // Workspace task — title is the first line after 【工作区任务】.
    const afterMarker = input.slice(wsIdx + WS_TASK_MARKER.length);
    const firstLine = afterMarker.split('\n')[0] || afterMarker;
    title = firstLine.trim().slice(0, 50);
  } else {
    const markerIdx = input.indexOf(USER_INTENT_MARKER);
    const userIntent = markerIdx >= 0
      ? input.slice(markerIdx + USER_INTENT_MARKER.length).trim()
      : input;
    title = userIntent.slice(0, 50);
  }
  await updateTaskType(taskId, 'unknown' as TaskType, title);
  await updateTaskContext(taskId, { executionStrategy: 'agent_dispatch', engine: intentType });

  await emitStepStarted(taskId, 'step_plan', '制定方案', `确认执行策略：${execLabel}`);
  await emitThinking(taskId, `好，用${execLabel}来处理这个...`);
  await emitStepCompleted(taskId, 'step_plan', '制定方案', `策略：${execLabel}`);

  // ── Step 3: 执行 ──────────────────────────────────────────────────────────
  await updateTaskStatus(taskId, 'executing');
  await emitStepStarted(taskId, 'step_execute', execLabel, execDetail);
  await emitThinking(taskId, '开始干活了...');

  const result = await dispatch(decision, input);

  if (!result.success) {
    await emitStepFailed(taskId, 'step_execute', execLabel, result.message || '执行失败', true);
    const { failTask } = await import('./task-manager');
    // Propagate structured error code (e.g. LLM_AUTH, LLM_RATE_LIMIT) so
    // the UI can render an actionable, bucketed message.
    const errorCode = typeof result.data?.errorCode === 'string' ? result.data.errorCode : undefined;
    await failTask(taskId, result.message || '执行失败', errorCode);
    return;
  }

  // ── Step 4: 异步任务（图片/视频/浏览器）────────────────────────────────────
  const isAsync = ASYNC_INTENTS.has(intentType) && result.data._async;

  if (isAsync) {
    const jobId = String(result.data.jobId || '');
    await prisma.task.update({
      where: { id: taskId },
      data: {
        externalJobId: jobId,
        externalEngine: result.engine,
      },
    });
    await emitStepCompleted(taskId, 'step_execute', execLabel, result.message);
    await emitStepStarted(taskId, 'step_wait', '等待结果', `任务已提交，等待 ${result.engine} 返回结果`);
    await emitThinking(taskId, `已提交给 ${result.engine}，等结果回来...`);
    console.log(`[WORKER] Task ${taskId} async job created: ${result.engine}/${jobId}`);
    // Task stays in "executing" — poller will complete it and emit step_complete for step_wait
    return;
  }

  // ── Step 5: 同步完成 ──────────────────────────────────────────────────────
  await emitStepCompleted(taskId, 'step_execute', execLabel, result.message);
  await emitThinking(taskId, '完成了，整理一下结果...');
  await emitStepStarted(taskId, 'step_finish', '整理结果', '格式化输出，准备呈现');
  await completeTask(taskId, result.data, result.message);
  await emitStepCompleted(taskId, 'step_finish', '整理结果', '已完成');
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
