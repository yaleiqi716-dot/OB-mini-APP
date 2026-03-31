import { prisma } from '@/lib/prisma';
import { completeTask, failTask, emitLog, emitEvent } from './task-manager';
import { pollImage } from './tools/leonardo';
import { pollVideo } from './tools/minimax';
import { pollAvatarVideo } from './tools/akool';
import { pollBrowserTask } from './tools/manus';

let pollerInterval: ReturnType<typeof setInterval> | null = null;

async function tick() {
  try {
    // Find all tasks in "executing" with an externalJobId
    const pendingJobs = await prisma.task.findMany({
      where: {
        status: 'executing',
        externalJobId: { not: null },
        externalEngine: { not: null },
      },
      take: 20,
    });

    if (pendingJobs.length === 0) return;

    for (const task of pendingJobs) {
      const engine = task.externalEngine!;
      const jobId = task.externalJobId!;

      try {
        let result: { status: string; error?: string; data?: Record<string, unknown> } | null = null;

        switch (engine) {
          case 'leonardo': {
            const r = await pollImage(jobId);
            if (r.status === 'complete') {
              result = { status: 'complete', data: { type: 'image', imageUrl: r.imageUrl } };
            } else if (r.status === 'failed') {
              result = { status: 'failed', error: r.error || '图片生成失败' };
            }
            break;
          }

          case 'minimax': {
            const r = await pollVideo(jobId);
            if (r.status === 'complete') {
              result = { status: 'complete', data: { type: 'video', videoUrl: r.videoUrl, jobId } };
            } else if (r.status === 'failed') {
              result = { status: 'failed', error: r.error || '视频生成失败' };
            }
            break;
          }

          case 'akool': {
            const r = await pollAvatarVideo(jobId);
            if (r.status === 'complete') {
              result = { status: 'complete', data: { type: 'avatar_video', videoUrl: r.videoUrl, jobId } };
            } else if (r.status === 'failed') {
              result = { status: 'failed', error: r.error || '数字人视频生成失败' };
            }
            break;
          }

          case 'manus': {
            const r = await pollBrowserTask(jobId);
            if (r.status === 'complete') {
              result = { status: 'complete', data: { type: 'browser_task', output: r.output } };
            } else if (r.status === 'failed') {
              result = { status: 'failed', error: r.error || 'Manus 任务失败' };
            }
            break;
          }

          default:
            console.warn(`[MEDIA_POLLER] Unknown engine: ${engine} for task ${task.id}`);
            continue;
        }

        if (!result) {
          // Still processing — skip
          continue;
        }

        if (result.status === 'complete' && result.data) {
          await completeTask(task.id, result.data, '任务完成');
          // Clear external job fields
          await prisma.task.update({
            where: { id: task.id },
            data: { externalJobId: null, externalEngine: null },
          });
          console.log(`[MEDIA_POLLER] Completed: ${task.id} (${engine})`);
        } else if (result.status === 'failed') {
          await failTask(task.id, result.error || '外部任务失败');
          await prisma.task.update({
            where: { id: task.id },
            data: { externalJobId: null, externalEngine: null },
          });
          console.log(`[MEDIA_POLLER] Failed: ${task.id} (${engine}): ${result.error}`);
        }
      } catch (err) {
        console.error(`[MEDIA_POLLER] Error polling ${engine}/${jobId} for task ${task.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[MEDIA_POLLER] Tick error:', err);
  }
}

export function startMediaJobPoller(intervalMs = 10_000) {
  if (pollerInterval) return;
  console.log(`[MEDIA_POLLER] Started (checking every ${intervalMs / 1000}s)`);
  pollerInterval = setInterval(tick, intervalMs);
}

export function stopMediaJobPoller() {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    console.log('[MEDIA_POLLER] Stopped');
  }
}
