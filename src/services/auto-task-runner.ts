import { prisma } from '@/lib/prisma';
import { createTask, updateTaskStatus, emitLog } from './task-manager';
import { checkCredits, getOrCreateUser } from './billing';
import { estimateCost } from '@/lib/cost';
import { TaskType } from '@/types/task';

let runnerInterval: ReturnType<typeof setInterval> | null = null;

// Simple cron matcher: checks if a cron expression should fire at the given date.
// Supports: minute hour dayOfMonth month dayOfWeek (* for any)
function shouldRun(cron: string, now: Date, lastRunAt: Date | null): boolean {
  // Don't run more than once per minute
  if (lastRunAt) {
    const diffMs = now.getTime() - lastRunAt.getTime();
    if (diffMs < 55_000) return false; // 55s guard
  }

  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return false;

  const [cronMin, cronHour, cronDom, cronMon, cronDow] = parts;

  const matches = (field: string, value: number): boolean => {
    if (field === '*') return true;
    // Handle comma-separated values: "0,30"
    const vals = field.split(',');
    return vals.some((v) => {
      // Handle step: "*/5"
      if (v.startsWith('*/')) {
        const step = parseInt(v.slice(2));
        return step > 0 && value % step === 0;
      }
      return parseInt(v) === value;
    });
  };

  return (
    matches(cronMin, now.getMinutes()) &&
    matches(cronHour, now.getHours()) &&
    matches(cronDom, now.getDate()) &&
    matches(cronMon, now.getMonth() + 1) &&
    matches(cronDow, now.getDay())
  );
}

async function runAutoTasks() {
  try {
    const autoTasks = await prisma.autoTask.findMany({
      where: { enabled: true },
    });

    if (autoTasks.length === 0) return;

    const now = new Date();

    for (const at of autoTasks) {
      if (!shouldRun(at.schedule, now, at.lastRunAt)) continue;

      console.log(`[AUTO_TASK] Triggering: ${at.id} (type: ${at.type})`);

      try {
        // Check user credits
        const creditCheck = await checkCredits(at.userId, at.type);
        if (!creditCheck.allowed) {
          console.log(`[AUTO_TASK] Skipped ${at.id}: ${creditCheck.reason}`);
          continue;
        }

        // Create task with source = 'auto'
        const cost = estimateCost(at.type);
        const task = await createTask(at.input, 'api', {
          userId: at.userId,
          estimatedCost: cost,
        });

        // Set priority (auto tasks get low priority)
        await prisma.task.update({
          where: { id: task.id },
          data: { priority: 0 },
        });

        // Move to queued (worker will pick it up)
        await updateTaskStatus(task.id, 'queued');
        await emitLog(task.id, '自动任务已触发');

        // Update lastRunAt
        await prisma.autoTask.update({
          where: { id: at.id },
          data: { lastRunAt: now },
        });

        console.log(`[AUTO_TASK] Created task ${task.id} for auto-task ${at.id}`);
      } catch (err) {
        console.error(`[AUTO_TASK] Failed for ${at.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[AUTO_TASK] Runner error:', err);
  }
}

export function startAutoTaskRunner(intervalMs = 60_000) {
  if (runnerInterval) return;
  console.log(`[AUTO_TASK] Runner started (checking every ${intervalMs / 1000}s)`);
  runnerInterval = setInterval(runAutoTasks, intervalMs);
}

export function stopAutoTaskRunner() {
  if (runnerInterval) {
    clearInterval(runnerInterval);
    runnerInterval = null;
    console.log('[AUTO_TASK] Runner stopped');
  }
}
