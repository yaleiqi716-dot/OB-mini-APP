import { prisma } from '@/lib/prisma';
import { TaskType } from '@/types/task';
import { estimateCost } from '@/lib/cost';

// ---- Plan configuration (single source of truth) ----

export interface PlanLimits {
  maxConcurrent: number;
  allowedTypes: TaskType[];
  dailyCredits: number;      // free plan: daily reset
  monthlyCredits: number;    // paid plans: monthly budget
}

const ALL_TYPES: TaskType[] = ['ppt', 'email', 'proposal', 'website', 'video', 'unknown'];

export const PLAN_CONFIG: Record<string, PlanLimits> = {
  free: {
    maxConcurrent: 3,  // preview: relaxed for testing
    allowedTypes: ALL_TYPES,  // preview: allow all types
    dailyCredits: 200,  // preview: generous daily credits
    monthlyCredits: 0,
  },
  basic: {
    maxConcurrent: 2,
    allowedTypes: ALL_TYPES,
    dailyCredits: 0,
    monthlyCredits: 500,
  },
  pro: {
    maxConcurrent: 3,
    allowedTypes: ALL_TYPES,
    dailyCredits: 0,
    monthlyCredits: 2000,
  },
  team: {
    maxConcurrent: 5,
    allowedTypes: ALL_TYPES,
    dailyCredits: 0,
    monthlyCredits: 10000,
  },
};

export function getPlanConfig(plan: string): PlanLimits {
  return PLAN_CONFIG[plan] || PLAN_CONFIG.free;
}

// ---- User management ----

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export async function getOrCreateUser(userId: string) {
  let user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    const config = getPlanConfig('free');
    user = await prisma.user.create({
      data: {
        id: userId,
        credits: config.dailyCredits,
        plan: 'free',
        dailyTaskCount: 0,
        dailyResetDate: today(),
      },
    });
  }

  // Check subscription expiry: downgrade to free if expired
  if (user.plan !== 'free' && user.expireAt && user.expireAt < new Date()) {
    user = await prisma.user.update({
      where: { id: userId },
      data: { plan: 'free', expireAt: null },
    });
  }

  // Daily reset for free plan — only reset task count, NOT credits
  // Credits are managed separately (purchases persist across days)
  if (user.plan === 'free' && user.dailyResetDate !== today()) {
    user = await prisma.user.update({
      where: { id: userId },
      data: {
        dailyTaskCount: 0,
        dailyResetDate: today(),
        // Do NOT reset credits here — credits persist
      },
    });
  }

  // Non-free: just reset daily count
  if (user.plan !== 'free' && user.dailyResetDate !== today()) {
    user = await prisma.user.update({
      where: { id: userId },
      data: { dailyTaskCount: 0, dailyResetDate: today() },
    });
  }

  return user;
}

// ---- Credits + capability check ----

export function getEstimatedCost(taskType: TaskType | string): number {
  return estimateCost(taskType);
}

export interface CheckResult {
  allowed: boolean;
  reason?: string;
  estimatedCost: number;
}

export async function checkCredits(userId: string, taskType: TaskType | string): Promise<CheckResult> {
  const user = await getOrCreateUser(userId);
  const config = getPlanConfig(user.plan);
  const cost = getEstimatedCost(taskType);

  // Type restriction
  if (!config.allowedTypes.includes(taskType as TaskType) && taskType !== 'unknown') {
    return {
      allowed: false,
      reason: `当前套餐不支持${taskType}类型任务，请升级`,
      estimatedCost: cost,
    };
  }

  // Credits check
  if (user.credits < cost) {
    return {
      allowed: false,
      reason: `额度不足（需要 ${cost}，剩余 ${user.credits}），请充值`,
      estimatedCost: cost,
    };
  }

  return { allowed: true, estimatedCost: cost };
}

// ---- Per-user concurrency check ----

export async function checkUserConcurrency(userId: string): Promise<boolean> {
  const user = await getOrCreateUser(userId);
  const config = getPlanConfig(user.plan);

  const running = await prisma.task.count({
    where: {
      userId,
      status: { in: ['understanding', 'structuring', 'executing'] },
      isExecuting: true,
    },
  });

  return running < config.maxConcurrent;
}

// ---- Deduct credits (idempotent) ----

// Charge credits — atomic, idempotent via charged flag.
// Call BEFORE execution starts (in worker, not in completeTask).
export async function chargeCredits(userId: string, taskId: string, taskType: TaskType | string): Promise<number> {
  // Idempotency: check charged flag
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return 0;
  if (task.charged) {
    console.log(`[BILLING] Already charged for task ${taskId} (cost: ${task.cost})`);
    return task.cost;
  }

  const user = await getOrCreateUser(userId);
  const calculatedCost = Math.min(estimateCost(taskType), user.credits);

  // Deduct from user + mark task as charged in one go
  await prisma.user.update({
    where: { id: userId },
    data: {
      credits: Math.max(0, user.credits - calculatedCost),
      dailyTaskCount: user.dailyTaskCount + 1,
    },
  });

  await prisma.task.update({
    where: { id: taskId },
    data: {
      charged: true,
      cost: calculatedCost,
      actualCost: calculatedCost,
    },
  });

  console.log(`[BILLING] Charged ${calculatedCost} credits for task ${taskId}`);
  return calculatedCost;
}

// Legacy alias
export const deductCredits = chargeCredits;

// ---- Unified billing gateway ----
// ALL task execution MUST go through this. No bypass allowed.

export class InsufficientCreditsError extends Error {
  required: number;
  current: number;
  constructor(required: number, current: number) {
    super(`额度不足（需要 ${required}，剩余 ${current}），请充值`);
    this.required = required;
    this.current = current;
  }
}

export async function executeWithBilling<T>(
  userId: string,
  taskId: string,
  taskType: TaskType | string,
  fn: () => Promise<T>
): Promise<T> {
  // 1. Check credits
  const user = await getOrCreateUser(userId);
  const cost = estimateCost(taskType);

  if (user.credits < cost) {
    throw new InsufficientCreditsError(cost, user.credits);
  }

  // 2. Charge FIRST (pre-pay model)
  await chargeCredits(userId, taskId, taskType);

  // 3. Execute
  return fn();
}

// ---- Credits management ----

export async function addCredits(userId: string, amount: number) {
  const user = await getOrCreateUser(userId);
  return prisma.user.update({
    where: { id: userId },
    data: { credits: user.credits + amount },
  });
}

export async function getUserStatus(userId: string) {
  const user = await getOrCreateUser(userId);
  const config = getPlanConfig(user.plan);
  return {
    id: user.id,
    credits: user.credits,
    plan: user.plan,
    expireAt: user.expireAt?.toISOString() || null,
    limits: {
      maxConcurrent: config.maxConcurrent,
      allowedTypes: config.allowedTypes,
      dailyCredits: config.dailyCredits,
      monthlyCredits: config.monthlyCredits,
    },
  };
}
