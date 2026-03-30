import { prisma } from '@/lib/prisma';
import { TaskType } from '@/types/task';

const DAILY_TASK_LIMIT = 3;

const TASK_CREDIT_COST: Partial<Record<TaskType, number>> = {
  email: 1,
  proposal: 2,
  ppt: 5,
  website: 2,
  video: 3,
};

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export async function getOrCreateQuota(userId: string) {
  let quota = await prisma.userQuota.findUnique({ where: { userId } });

  if (!quota) {
    quota = await prisma.userQuota.create({
      data: { userId, credits: 5, dailyTaskCount: 0, dailyResetDate: today() },
    });
  }

  // Reset daily count if date changed
  if (quota.dailyResetDate !== today()) {
    quota = await prisma.userQuota.update({
      where: { userId },
      data: { dailyTaskCount: 0, dailyResetDate: today() },
    });
  }

  return quota;
}

export async function checkQuota(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const quota = await getOrCreateQuota(userId);

  if (quota.dailyTaskCount >= DAILY_TASK_LIMIT) {
    return { allowed: false, reason: '今日任务次数已用完，请明天再试' };
  }

  if (quota.credits <= 0) {
    return { allowed: false, reason: '额度不足，请充值后继续使用' };
  }

  return { allowed: true };
}

export async function consumeQuota(userId: string, taskType: TaskType) {
  const cost = TASK_CREDIT_COST[taskType] || 1;
  const quota = await getOrCreateQuota(userId);

  await prisma.userQuota.update({
    where: { userId },
    data: {
      credits: Math.max(0, quota.credits - cost),
      dailyTaskCount: quota.dailyTaskCount + 1,
    },
  });
}

export async function addCredits(userId: string, amount: number) {
  const quota = await getOrCreateQuota(userId);
  return prisma.userQuota.update({
    where: { userId },
    data: { credits: quota.credits + amount },
  });
}

export function getCreditCost(taskType: TaskType): number {
  return TASK_CREDIT_COST[taskType] || 1;
}
