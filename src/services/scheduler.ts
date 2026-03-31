import { prisma } from '@/lib/prisma';
import { createTask, updateTaskStatus, emitLog, emitEvent } from './task-manager';
import { executeWithBilling, InsufficientCreditsError, getOrCreateUser } from './billing';
import { estimateCost } from '@/lib/cost';

const FREE_AUTO_TASK_LIMIT = 3;

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

function advanceNextRun(from: Date, cron: string): Date {
  const next = new Date(from);
  if (cron === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

async function tick() {
  try {
    const now = new Date();
    const due = await prisma.scheduledTask.findMany({
      where: {
        enabled: true,
        nextRunAt: { lte: now },
      },
    });

    if (due.length === 0) return;

    for (const st of due) {
      try {
        console.log(`[SCHEDULER] Firing: ${st.id} (${st.cron})`);

        // Free-tier auto-task limit: max 3 runs then stop
        const user = await getOrCreateUser(st.userId);
        if (user.plan === 'free') {
          const autoTaskCount = await prisma.task.count({
            where: { userId: st.userId, source: 'api' },
          });
          if (autoTaskCount >= FREE_AUTO_TASK_LIMIT) {
            console.log(`[SCHEDULER] Free user ${st.userId} hit auto-task limit (${FREE_AUTO_TASK_LIMIT}), disabling ${st.id}`);
            await prisma.scheduledTask.update({
              where: { id: st.id },
              data: { enabled: false },
            });
            continue;
          }
        }

        const cost = estimateCost(st.type);
        const task = await createTask(st.input, 'api', {
          userId: st.userId,
          estimatedCost: cost,
        });

        // All execution goes through executeWithBilling — no bypass
        await executeWithBilling(st.userId, task.id, st.type, async () => {
          await prisma.task.update({
            where: { id: task.id },
            data: { priority: 0 },
          });
          await updateTaskStatus(task.id, 'queued');
          await emitLog(task.id, '定时任务已自动触发');
        });

        // Advance nextRunAt
        await prisma.scheduledTask.update({
          where: { id: st.id },
          data: { nextRunAt: advanceNextRun(st.nextRunAt, st.cron) },
        });

        console.log(`[SCHEDULER] Created task ${task.id} from scheduled ${st.id}`);
      } catch (err) {
        if (err instanceof InsufficientCreditsError) {
          console.log(`[SCHEDULER] Blocked task from ${st.id}: insufficient credits`);
          try {
            const blockedTask = await prisma.task.findFirst({
              where: { userId: st.userId, source: 'api', status: 'pending' },
              orderBy: { createdAt: 'desc' },
            });
            if (blockedTask) {
              await prisma.task.update({
                where: { id: blockedTask.id },
                data: { status: 'blocked', errorMessage: err.message },
              });
              await emitEvent(blockedTask.id, 'payment_required', {
                required: err.required,
                current: err.current,
              });
              await emitEvent(blockedTask.id, 'status_change', { status: 'blocked' });
            }
          } catch {}
        } else {
          console.error(`[SCHEDULER] Failed for ${st.id}:`, err);
        }
        // Always advance nextRunAt so it doesn't retry every minute
        await prisma.scheduledTask.update({
          where: { id: st.id },
          data: { nextRunAt: advanceNextRun(st.nextRunAt, st.cron) },
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[SCHEDULER] Tick error:', err);
  }
}

export function startScheduler(intervalMs = 60_000) {
  if (schedulerInterval) return;
  console.log(`[SCHEDULER] Started (checking every ${intervalMs / 1000}s)`);
  tick();
  schedulerInterval = setInterval(tick, intervalMs);
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[SCHEDULER] Stopped');
  }
}
