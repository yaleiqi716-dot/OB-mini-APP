import { prisma } from '@/lib/prisma';
import { eventBus } from './event-bus';
import { TaskStatus, TaskType, TaskEventType, TaskSource } from '@/types/task';
import { Interaction } from '@/types/interaction';
import { VALID_STATUS_TRANSITIONS } from '@/lib/constants';

// ---- JSON helpers (centralized) ----

function parseCtx(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); } catch { return {}; }
}

function parseResult(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function parseEventData(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); } catch { return {}; }
}

// ---- Serialized task/event formatting for API responses ----

export function formatTask(t: {
  id: string; type: string; status: string; title: string; input: string;
  context: string; currentStep: string; result: string | null;
  errorMessage: string | null; source: string; createdAt: Date; updatedAt: Date;
  events?: { id: string; taskId: string; type: string; data: string; createdAt: Date }[];
}) {
  return {
    ...t,
    context: parseCtx(t.context),
    result: parseResult(t.result),
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
    data: parseEventData(e.data),
    createdAt: e.createdAt.toISOString(),
  };
}

// ---- Task CRUD ----

export async function createTask(input: string, source: TaskSource = 'agent') {
  const task = await prisma.task.create({
    data: {
      type: 'unknown',
      input,
      source,
      status: 'pending',
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

  const existing = parseCtx(task.context);
  const merged = { ...existing, ...contextUpdate };

  return prisma.task.update({
    where: { id: taskId },
    data: { context: JSON.stringify(merged) },
  });
}

export async function updateTaskStep(taskId: string, step: string) {
  return prisma.task.update({
    where: { id: taskId },
    data: { currentStep: step },
  });
}

export async function completeTask(taskId: string, result: unknown) {
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: 'completed',
      result: JSON.stringify(result),
    },
  });

  await emitEvent(taskId, 'status_change', { status: 'completed' });
  await emitEvent(taskId, 'artifact', { result });
  return updated;
}

export async function failTask(taskId: string, errorMessage: string) {
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: 'failed',
      errorMessage,
    },
  });

  await emitEvent(taskId, 'error', { message: errorMessage });
  await emitEvent(taskId, 'status_change', { status: 'failed' });
  return updated;
}

export async function requestInteraction(taskId: string, interaction: Interaction) {
  await prisma.task.update({
    where: { id: taskId },
    data: { status: 'interacting' },
  });

  await emitEvent(taskId, 'interaction_request', interaction);
}

export async function emitEvent(taskId: string, type: TaskEventType, data: unknown) {
  const event = await prisma.taskEvent.create({
    data: {
      taskId,
      type,
      data: JSON.stringify(data),
    },
  });

  eventBus.publish(taskId, { type, data });
  return event;
}

export async function emitLog(taskId: string, message: string) {
  return emitEvent(taskId, 'log', { message });
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
  return parseCtx(task.context);
}
