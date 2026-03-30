import { prisma } from '@/lib/prisma';
import { TaskType } from '@/types/task';

const DAILY_TASK_LIMIT: Record<string, number> = {
  free: 3,
  basic: 10,
  pro: 50,
  team: 200,
};

const TASK_CREDIT_COST: Record<string, number> = {
  ppt: 20,
  email: 5,
  proposal: 15,
  website: 10,
  video: 15,
  unknown: 5,
};

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export async function getOrCreateUser(userId: string) {
  let user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    user = await prisma.user.create({
      data: { id: userId, credits: 100, plan: 'free', dailyTaskCount: 0, dailyResetDate: today() },
    });
  }

  // Daily reset
  if (user.dailyResetDate !== today()) {
    user = await prisma.user.update({
      where: { id: userId },
      data: { dailyTaskCount: 0, dailyResetDate: today() },
    });
  }

  return user;
}

export function getEstimatedCost(taskType: TaskType | string): number {
  return TASK_CREDIT_COST[taskType] || 5;
}

export async function checkCredits(
  userId: string,
  taskType: TaskType | string
): Promise<{ allowed: boolean; reason?: string; estimatedCost: number }> {
  const user = await getOrCreateUser(userId);
  const cost = getEstimatedCost(taskType);
  const dailyLimit = DAILY_TASK_LIMIT[user.plan] || 3;

  if (user.dailyTaskCount >= dailyLimit) {
    return { allowed: false, reason: `今日任务次数已达上限（${dailyLimit}次），请明天再试`, estimatedCost: cost };
  }

  if (user.credits < cost) {
    return { allowed: false, reason: `额度不足（需要 ${cost}，剩余 ${user.credits}），请充值`, estimatedCost: cost };
  }

  return { allowed: true, estimatedCost: cost };
}

export async function deductCredits(userId: string, taskId: string, taskType: TaskType | string) {
  const user = await getOrCreateUser(userId);
  const cost = getEstimatedCost(taskType);
  const actualCost = Math.min(cost, user.credits);

  await prisma.user.update({
    where: { id: userId },
    data: {
      credits: Math.max(0, user.credits - actualCost),
      dailyTaskCount: user.dailyTaskCount + 1,
    },
  });

  // Record actual cost on task
  await prisma.task.update({
    where: { id: taskId },
    data: { actualCost },
  });

  return actualCost;
}

export async function addCredits(userId: string, amount: number) {
  const user = await getOrCreateUser(userId);
  return prisma.user.update({
    where: { id: userId },
    data: { credits: user.credits + amount },
  });
}

export async function getUserStatus(userId: string) {
  const user = await getOrCreateUser(userId);
  const dailyLimit = DAILY_TASK_LIMIT[user.plan] || 3;
  return {
    credits: user.credits,
    plan: user.plan,
    dailyTaskCount: user.dailyTaskCount,
    dailyLimit,
  };
}
