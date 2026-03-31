import { prisma } from '@/lib/prisma';
import { eventBus } from './event-bus';
import { TaskStatus, TaskType, TaskEventType, TaskSource } from '@/types/task';
import { Interaction } from '@/types/interaction';
import { VALID_STATUS_TRANSITIONS } from '@/lib/constants';

// ---- JSON serialization boundary ----
// SQLite stores JSON as String. These three helpers are the ONLY place
// in the entire project where JSON.stringify / JSON.parse touch task data fields.

function toJson(obj: unknown): string {
  return JSON.stringify(obj);
}

function fromJson(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); } catch { return {}; }
}

function fromJsonNullable(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ---- Formatting for API responses ----

export function formatTask(t: {
  id: string; type: string; status: string; title: string; input: string;
  context: string; currentStep: string; result: string | null;
  errorMessage: string | null; source: string;
  estimatedCost?: number; actualCost?: number; userId?: string | null; assigneeId?: string | null;
  createdAt: Date; updatedAt: Date;
  events?: { id: string; taskId: string; type: string; data: string; createdAt: Date }[];
}) {
  return {
    id: t.id,
    type: t.type,
    status: t.status,
    title: t.title,
    input: t.input,
    context: fromJson(t.context),
    currentStep: t.currentStep,
    result: fromJsonNullable(t.result),
    errorMessage: t.errorMessage,
    source: t.source,
    estimatedCost: t.estimatedCost || 0,
    actualCost: t.actualCost || 0,
    assigneeId: t.assigneeId || null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    events: t.events?.map(formatEvent) ?? [],
  };
}

export function formatEvent(e: { id: string; taskId: string; type: string; data: string; createdAt: Date }) {
  return {
    id: e.id,
    taskId: e.taskId,
    type: e.type,
    data: fromJson(e.data),
    createdAt: e.createdAt.toISOString(),
  };
}

// ---- Task CRUD ----

export async function createTask(
  input: string,
  source: TaskSource = 'agent',
  opts?: { userId?: string; estimatedCost?: number; assigneeId?: string }
) {
  const task = await prisma.task.create({
    data: {
      type: 'unknown',
      input,
      source,
      status: 'pending',
      userId: opts?.userId || null,
      estimatedCost: opts?.estimatedCost || 0,
      assigneeId: opts?.assigneeId || null,
    },
  });

  await emitEvent(task.id, 'status_change', { status: 'pending' });
  return task;
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error(`任务不存在: ${taskId}`);

  const currentStatus = task.status as TaskStatus;
  const allowed = VALID_STATUS_TRANSITIONS[currentStatus];
  if (!allowed.includes(status)) {
    throw new Error(`无效的状态转换: ${currentStatus} -> ${status}`);
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { status },
  });

  await emitEvent(taskId, 'status_change', { status, previousStatus: currentStatus });
  return updated;
}

export async function updateTaskType(taskId: string, type: TaskType, title: string) {
  return prisma.task.update({
    where: { id: taskId },
    data: { type, title },
  });
}

export async function updateTaskContext(taskId: string, contextUpdate: Record<string, unknown>) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error(`任务不存在: ${taskId}`);

  const existing = fromJson(task.context);
  const merged = { ...existing, ...contextUpdate };

  return prisma.task.update({
    where: { id: taskId },
    data: { context: toJson(merged) },
  });
}

export async function updateTaskStep(taskId: string, step: string) {
  return prisma.task.update({
    where: { id: taskId },
    data: { currentStep: step },
  });
}

// completeTask: 统一任务完成入口
// 写入 result → 发 task_completed → status_change → artifact
// workflow 层只需调用此方法，传入对象即可
export async function completeTask(taskId: string, result: Record<string, unknown>, message?: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });

  // Idempotency: skip if already completed or failed
  if (task?.status === 'completed' || task?.status === 'failed') {
    console.log(`[IDEMPOTENT] completeTask skipped for ${taskId} (status: ${task.status})`);
    return;
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: 'completed',
      result: toJson(result),
    },
  });

  // Credits already charged in worker before execution — read cost from task
  const cost = task?.cost || 0;

  await emitEvent(taskId, 'task_completed', {
    message: message || '任务完成',
    cost,
    result,
  });
  await emitEvent(taskId, 'status_change', { status: 'completed' });
  await emitEvent(taskId, 'artifact', { result });

  // Emit next-step suggestions to drive continued engagement
  const taskType = task?.type || 'unknown';
  const suggestions = getNextSuggestions(taskType, task?.input || '');
  if (suggestions.length > 0) {
    await emitEvent(taskId, 'next_suggestions', { suggestions });
  }
}

function getNextSuggestions(type: string, input: string): { label: string; prompt: string; type: string; cost: number }[] {
  const base = input.slice(0, 80);
  const map: Record<string, { label: string; prompt: string; type: string; cost: number }[]> = {
    email: [
      { label: '优化这封邮件', prompt: `帮我优化这封邮件的措辞和结构：${base}`, type: 'email', cost: 5 },
      { label: '生成高级版', prompt: `帮我重新写一版更专业的邮件：${base}`, type: 'email', cost: 10 },
      { label: '写跟进邮件', prompt: `帮我写一封跟进邮件：${base}`, type: 'email', cost: 5 },
      { label: '发送给客户', prompt: `帮我整理并发送这封邮件给客户：${base}`, type: 'email', cost: 3 },
    ],
    ppt: [
      { label: '优化内容', prompt: `帮我优化这份演示文稿：${base}`, type: 'ppt', cost: 10 },
      { label: '生成高级版', prompt: `帮我重新做一版更专业的演示文稿：${base}`, type: 'ppt', cost: 20 },
      { label: '生成演讲稿', prompt: `根据这份PPT帮我写演讲稿：${base}`, type: 'proposal', cost: 15 },
      { label: '导出并发送', prompt: `帮我写一封邮件发送这份PPT：${base}`, type: 'email', cost: 5 },
    ],
    proposal: [
      { label: '优化方案', prompt: `帮我优化这份方案：${base}`, type: 'proposal', cost: 10 },
      { label: '生成高级版', prompt: `帮我重写一版更完整的方案：${base}`, type: 'proposal', cost: 15 },
      { label: '做配套PPT', prompt: `根据方案做演示文稿：${base}`, type: 'ppt', cost: 20 },
      { label: '发送给客户', prompt: `帮我写邮件发送这份方案：${base}`, type: 'email', cost: 5 },
    ],
    direct: [
      { label: '优化结果', prompt: `帮我优化上面的内容：${base}`, type: 'unknown', cost: 5 },
      { label: '生成高级版', prompt: `帮我重新生成一版更专业的：${base}`, type: 'unknown', cost: 10 },
    ],
  };
  return map[type] || map.direct;
}

export async function failTask(taskId: string, errorMessage: string) {
  // Idempotency: skip if already completed or failed
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (existing?.status === 'completed' || existing?.status === 'failed') {
    console.log(`[IDEMPOTENT] failTask skipped for ${taskId} (status: ${existing.status})`);
    return;
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: 'failed',
      errorMessage,
    },
  });

  await emitEvent(taskId, 'error', { message: errorMessage });
  await emitEvent(taskId, 'status_change', { status: 'failed' });
}

export async function requestInteraction(taskId: string, interaction: Interaction) {
  await prisma.task.update({
    where: { id: taskId },
    data: { status: 'interacting' },
  });

  await emitEvent(taskId, 'interaction_request', interaction as unknown as Record<string, unknown>);
}

export async function emitEvent(taskId: string, type: TaskEventType, data: Record<string, unknown>) {
  const event = await prisma.taskEvent.create({
    data: {
      taskId,
      type,
      data: toJson(data),
    },
  });

  eventBus.publish(taskId, { type, data });
  return event;
}

export async function emitLog(taskId: string, message: string) {
  return emitEvent(taskId, 'log', { message });
}

export async function emitThinking(taskId: string, text: string) {
  return emitEvent(taskId, 'thinking', { text });
}

export async function getTask(taskId: string) {
  return prisma.task.findUnique({
    where: { id: taskId },
    include: { events: { orderBy: { createdAt: 'asc' } } },
  });
}

export async function getTaskFormatted(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { events: { orderBy: { createdAt: 'asc' } } },
  });
  if (!task) return null;
  return formatTask(task);
}

export async function listTasks(limit = 20) {
  return prisma.task.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      events: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
}

export async function getTaskContext(taskId: string): Promise<Record<string, unknown>> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error(`任务不存在: ${taskId}`);
  return fromJson(task.context);
}
