import { prisma } from '@/lib/prisma';
import { createTask, updateTaskStatus, emitLog } from './task-manager';
import { checkCredits } from './billing';
import { estimateCost } from '@/lib/cost';

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

function computeNextRun(cron: string): Date {
  const now = new Date();
  if (cron === 'weekly') {
    const next = new Date(now);
    next.setDate(next.getDate() + 7);
    next.setHours(9, 0, 0, 0);
    return next;
  }
  // daily
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
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

        const creditCheck = await checkCredits(st.userId, st.type);
        if (!creditCheck.allowed) {
          console.log(`[SCHEDULER] Skipped ${st.id}: ${creditCheck.reason}`);
          // Still advance nextRunAt so it doesn't retry every minute
          await prisma.scheduledTask.update({
            where: { id: st.id },
            data: { nextRunAt: computeNextRun(st.cron) },
          });
          continue;
        }

        const cost = estimateCost(st.type);
        const task = await createTask(st.input, 'api', {
          userId: st.userId,
          estimatedCost: cost,
        });

        await prisma.task.update({
          where: { id: task.id },
          data: { priority: 0 },
        });

        await updateTaskStatus(task.id, 'queued');
        await emitLog(task.id, '定时任务已自动触发');

        // Advance nextRunAt
        await prisma.scheduledTask.update({
          where: { id: st.id },
          data: { nextRunAt: computeNextRun(st.cron) },
        });

        console.log(`[SCHEDULER] Created task ${task.id} from scheduled ${st.id}`);
      } catch (err) {
        console.error(`[SCHEDULER] Failed for ${st.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[SCHEDULER] Tick error:', err);
  }
}

export function startScheduler(intervalMs = 60_000) {
  if (schedulerInterval) return;
  console.log(`[SCHEDULER] Started (checking every ${intervalMs / 1000}s)`);
  schedulerInterval = setInterval(tick, intervalMs);
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[SCHEDULER] Stopped');
  }
}
