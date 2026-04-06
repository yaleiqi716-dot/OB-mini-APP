import { prisma } from '@/lib/prisma';
import { TaskType } from '@/types/task';
import { estimateCost } from '@/lib/cost';

// ── Plan configuration (aligned with billing-config.ts v1) ──

export interface PlanLimits {
  maxConcurrent: number;
  allowedTypes: TaskType[];
  dailyTrialCredits: number;    // 每日体验赠额
  monthlySubscriptionCredits: number; // 订阅积分/月
}

const ALL_TYPES: TaskType[] = ['ppt', 'email', 'proposal', 'website', 'video', 'unknown'];

export const PLAN_CONFIG: Record<string, PlanLimits> = {
  free: {
    maxConcurrent: 1,
    allowedTypes: ['ppt', 'email', 'proposal', 'unknown'] as TaskType[],
    dailyTrialCredits: 120,
    monthlySubscriptionCredits: 0,
  },
  basic: {
    maxConcurrent: 3,
    allowedTypes: ALL_TYPES,
    dailyTrialCredits: 60,
    monthlySubscriptionCredits: 2000,
  },
  pro: {
    maxConcurrent: 10,
    allowedTypes: ALL_TYPES,
    dailyTrialCredits: 120,
    monthlySubscriptionCredits: 5500,
  },
  team: {
    maxConcurrent: 10,
    allowedTypes: ALL_TYPES,
    dailyTrialCredits: 120,
    monthlySubscriptionCredits: 6000,
  },
};

export function getPlanConfig(plan: string): PlanLimits {
  return PLAN_CONFIG[plan] || PLAN_CONFIG.free;
}

// ── Helpers ──

function today(): string {
  return new Date().toISOString().split('T')[0];
}

// Total available credits across all buckets
function totalCredits(user: { signupBonusCredits: number; dailyTrialCredits: number; subscriptionCredits: number; generalCredits: number; rewardCredits: number; credits: number }): number {
  return user.dailyTrialCredits + user.signupBonusCredits + user.subscriptionCredits + user.generalCredits + user.rewardCredits + user.credits;
}

// ── User management with daily trial grant ──

const SIGNUP_BONUS = 500;

export async function getOrCreateUser(userId: string) {
  let user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    const config = getPlanConfig('free');
    user = await prisma.user.create({
      data: {
        id: userId,
        credits: 0,
        signupBonusCredits: SIGNUP_BONUS,
        dailyTrialCredits: config.dailyTrialCredits,
        subscriptionCredits: 0,
        generalCredits: 0,
        rewardCredits: 0,
        dailyCreditsGrantedAt: today(),
        plan: 'free',
        dailyTaskCount: 0,
        dailyResetDate: today(),
      },
    });
  }

  // ── Subscription period check ──
  // Uses currentPeriodEnd (set by webhook) or falls back to expireAt
  const now = new Date();
  const periodEnd = user.currentPeriodEnd || user.expireAt;

  if (user.plan !== 'free' && periodEnd && periodEnd < now) {
    // Period has ended — determine what happens next
    if (user.cancelAtPeriodEnd) {
      // User cancelled: downgrade to free, clear subscription state
      user = await prisma.user.update({
        where: { id: userId },
        data: {
          plan: 'free',
          expireAt: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          pendingPlan: null,
          subscriptionCredits: 0,
          subscriptionResetAt: today(),
        },
      });
      console.log(`[BILLING] Subscription cancelled for ${userId}, downgraded to free`);
    } else if (user.pendingPlan) {
      // User requested downgrade: switch to target plan
      // subscriptionCredits = 0: new credits only come with next payment
      // subscriptionResetAt: keep aligned to old period start so the monthly
      // reset check (subscriptionResetAt !== currentPeriodStart) does NOT
      // trigger a free grant — user must pay for the new plan first.
      user = await prisma.user.update({
        where: { id: userId },
        data: {
          plan: user.pendingPlan,
          pendingPlan: null,
          subscriptionCredits: 0,
          subscriptionResetAt: user.currentPeriodStart
            ? user.currentPeriodStart.toISOString().split('T')[0]
            : today(),
        },
      });
      console.log(`[BILLING] Downgraded ${userId} to ${user.plan}`);
    } else {
      // Normal expiry without cancel/downgrade: just downgrade to free
      // (User didn't renew)
      user = await prisma.user.update({
        where: { id: userId },
        data: {
          plan: 'free',
          expireAt: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          subscriptionCredits: 0,
          subscriptionResetAt: today(),
        },
      });
      console.log(`[BILLING] Subscription expired for ${userId}, downgraded to free`);
    }
  }

  // ── Subscription credits monthly reset (for active subscribers) ──
  // If user is on a paid plan and we haven't reset this period yet
  if (user.plan !== 'free' && user.currentPeriodStart) {
    const periodStartStr = user.currentPeriodStart.toISOString().split('T')[0];
    if (user.subscriptionResetAt !== periodStartStr) {
      // New period started — reset subscription credits to plan allowance
      const planConfig = getPlanConfig(user.plan);
      user = await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionCredits: planConfig.monthlySubscriptionCredits,
          subscriptionResetAt: periodStartStr,
        },
      });
      console.log(`[BILLING] Reset subscription credits for ${userId}: ${planConfig.monthlySubscriptionCredits}`);
    }
  }

  // ── Daily reset — grant daily trial credits if new day ──
  const config = getPlanConfig(user.plan);
  if (user.dailyCreditsGrantedAt !== today()) {
    user = await prisma.user.update({
      where: { id: userId },
      data: {
        dailyTrialCredits: config.dailyTrialCredits,
        dailyCreditsGrantedAt: today(),
        dailyTaskCount: 0,
        dailyResetDate: today(),
      },
    });
  } else if (user.dailyResetDate !== today()) {
    user = await prisma.user.update({
      where: { id: userId },
      data: { dailyTaskCount: 0, dailyResetDate: today() },
    });
  }

  return user;
}

// ── Credits + capability check ──

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

  // Credits check — total across all buckets
  const total = totalCredits(user);
  if (total < cost) {
    return {
      allowed: false,
      reason: `积分不足（需要 ${cost}，剩余 ${total}），请充值`,
      estimatedCost: cost,
    };
  }

  return { allowed: true, estimatedCost: cost };
}

// ── Per-user concurrency check ──

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

// ── Five-level credit consumption ──
// Order: dailyTrialCredits → signupBonusCredits → subscriptionCredits → generalCredits → rewardCredits

export interface ConsumeResult {
  success: boolean;
  totalDeducted: number;
  breakdown: {
    dailyTrial: number;
    signupBonus: number;
    subscription: number;
    general: number;
    reward: number;
    legacy: number;
  };
  remaining: {
    dailyTrial: number;
    signupBonus: number;
    subscription: number;
    general: number;
    reward: number;
    legacy: number;
  };
}

function consumeFromBuckets(
  amount: number,
  buckets: { dailyTrial: number; signupBonus: number; subscription: number; general: number; reward: number; legacy: number }
): ConsumeResult {
  let remaining = amount;
  const deducted = { dailyTrial: 0, signupBonus: 0, subscription: 0, general: 0, reward: 0, legacy: 0 };

  // 1. Daily trial credits
  const d1 = Math.min(remaining, buckets.dailyTrial);
  deducted.dailyTrial = d1; buckets.dailyTrial -= d1; remaining -= d1;

  // 2. Signup bonus
  const d2 = Math.min(remaining, buckets.signupBonus);
  deducted.signupBonus = d2; buckets.signupBonus -= d2; remaining -= d2;

  // 3. Subscription credits
  const d3 = Math.min(remaining, buckets.subscription);
  deducted.subscription = d3; buckets.subscription -= d3; remaining -= d3;

  // 4. General credits
  const d4 = Math.min(remaining, buckets.general);
  deducted.general = d4; buckets.general -= d4; remaining -= d4;

  // 5. Reward credits
  const d5 = Math.min(remaining, buckets.reward);
  deducted.reward = d5; buckets.reward -= d5; remaining -= d5;

  // 6. Legacy credits (fallback for old users who still have mixed credits)
  const d6 = Math.min(remaining, buckets.legacy);
  deducted.legacy = d6; buckets.legacy -= d6; remaining -= d6;

  return {
    success: remaining === 0,
    totalDeducted: amount - remaining,
    breakdown: deducted,
    remaining: { ...buckets },
  };
}

// ── Charge credits (idempotent, five-level) ──

export async function chargeCredits(userId: string, taskId: string, taskType: TaskType | string): Promise<number> {
  // Idempotency: check charged flag
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return 0;
  if (task.charged) {
    console.log(`[BILLING] Already charged for task ${taskId} (cost: ${task.cost})`);
    return task.cost;
  }

  const user = await getOrCreateUser(userId);
  const calculatedCost = estimateCost(taskType);

  // Five-level consumption
  const result = consumeFromBuckets(calculatedCost, {
    dailyTrial: user.dailyTrialCredits,
    signupBonus: user.signupBonusCredits,
    subscription: user.subscriptionCredits,
    general: user.generalCredits,
    reward: user.rewardCredits,
    legacy: user.credits,
  });

  if (!result.success) {
    // Not enough across all buckets — charge what we can
    console.warn(`[BILLING] Insufficient credits for task ${taskId}: needed ${calculatedCost}, available ${result.totalDeducted}`);
  }

  // Update user balances
  await prisma.user.update({
    where: { id: userId },
    data: {
      dailyTrialCredits: result.remaining.dailyTrial,
      signupBonusCredits: result.remaining.signupBonus,
      subscriptionCredits: result.remaining.subscription,
      generalCredits: result.remaining.general,
      rewardCredits: result.remaining.reward,
      credits: result.remaining.legacy,
      dailyTaskCount: user.dailyTaskCount + 1,
    },
  });

  // Mark task as charged
  await prisma.task.update({
    where: { id: taskId },
    data: {
      charged: true,
      cost: result.totalDeducted,
      actualCost: result.totalDeducted,
    },
  });

  console.log(`[BILLING] Charged ${result.totalDeducted} for task ${taskId} (daily:${result.breakdown.dailyTrial} signup:${result.breakdown.signupBonus} sub:${result.breakdown.subscription} gen:${result.breakdown.general} reward:${result.breakdown.reward} legacy:${result.breakdown.legacy})`);
  return result.totalDeducted;
}

// Legacy alias
export const deductCredits = chargeCredits;

// ── Billing gateway ──

export class InsufficientCreditsError extends Error {
  required: number;
  current: number;
  constructor(required: number, current: number) {
    super(`积分不足（需要 ${required}，剩余 ${current}），请充值`);
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
  const user = await getOrCreateUser(userId);
  const cost = estimateCost(taskType);
  const total = totalCredits(user);

  if (total < cost) {
    throw new InsufficientCreditsError(cost, total);
  }

  await chargeCredits(userId, taskId, taskType);
  return fn();
}

// ── Credits management ──

export async function addCredits(userId: string, amount: number) {
  // New purchases go to generalCredits
  const user = await getOrCreateUser(userId);
  return prisma.user.update({
    where: { id: userId },
    data: { generalCredits: user.generalCredits + amount },
  });
}

export async function getUserStatus(userId: string) {
  const user = await getOrCreateUser(userId);
  const config = getPlanConfig(user.plan);
  const total = totalCredits(user);
  return {
    id: user.id,
    credits: total, // Total for backward compat
    signupBonusCredits: user.signupBonusCredits,
    dailyTrialCredits: user.dailyTrialCredits,
    subscriptionCredits: user.subscriptionCredits,
    generalCredits: user.generalCredits,
    rewardCredits: user.rewardCredits,
    plan: user.plan,
    expireAt: user.expireAt?.toISOString() || null,
    cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    canceledAt: user.canceledAt?.toISOString() || null,
    pendingPlan: user.pendingPlan,
    currentPeriodEnd: user.currentPeriodEnd?.toISOString() || null,
    limits: {
      maxConcurrent: config.maxConcurrent,
      allowedTypes: config.allowedTypes,
      dailyTrialCredits: config.dailyTrialCredits,
      monthlySubscriptionCredits: config.monthlySubscriptionCredits,
    },
  };
}
