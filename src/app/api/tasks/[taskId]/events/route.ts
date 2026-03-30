import { NextRequest } from 'next/server';
import { eventBus } from '@/services/event-bus';
import { prisma } from '@/lib/prisma';
import { sseHeaders, encodeSSE } from '@/lib/sse';
import { formatEvent } from '@/services/task-manager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const { taskId } = params;

  // Verify task exists
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return new Response('任务不存在', { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(encodeSSE('connected', { taskId })));

      // Replay all events from DB
      const recentEvents = await prisma.taskEvent.findMany({
        where: { taskId },
        orderBy: { createdAt: 'asc' },
        take: 200,
      });

      for (const event of recentEvents) {
        controller.enqueue(
          encoder.encode(encodeSSE('task_event', formatEvent(event)))
        );
      }

      controller.enqueue(encoder.encode(encodeSSE('replay_complete', { count: recentEvents.length })));

      // Subscribe to live events
      const unsubscribe = eventBus.subscribe(taskId, (event) => {
        try {
          controller.enqueue(
            encoder.encode(
              encodeSSE('task_event', {
                type: event.type,
                data: event.data,
                createdAt: new Date().toISOString(),
              })
            )
          );
        } catch {
          unsubscribe();
        }
      });

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 15000);

      // Cleanup on abort
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubscribe();
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
