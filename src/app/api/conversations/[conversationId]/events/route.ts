import { NextRequest } from 'next/server';
import { eventBus } from '@/services/event-bus';
import { prisma } from '@/lib/prisma';
import { sseHeaders, encodeSSE } from '@/lib/sse';
import { formatEvent } from '@/services/task-manager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/conversations/:conversationId/events — 聚合该会话中所有 task 的事件流
export async function GET(
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  const { conversationId } = params;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      tasks: {
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      },
    },
  });

  if (!conversation) {
    return new Response('会话不存在', { status: 404 });
  }

  const taskIds = conversation.tasks.map((t) => t.id);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(encodeSSE('connected', { conversationId })));

      // Replay all events from all tasks in this conversation
      const recentEvents = await prisma.taskEvent.findMany({
        where: { taskId: { in: taskIds } },
        orderBy: { createdAt: 'asc' },
        take: 500,
      });

      for (const event of recentEvents) {
        controller.enqueue(
          encoder.encode(
            encodeSSE('task_event', {
              ...formatEvent(event),
              taskId: event.taskId,
            })
          )
        );
      }

      controller.enqueue(
        encoder.encode(encodeSSE('replay_complete', { count: recentEvents.length }))
      );

      // Subscribe to live events from all tasks in this conversation
      const unsubscribers = taskIds.map((taskId) =>
        eventBus.subscribe(taskId, (event) => {
          try {
            controller.enqueue(
              encoder.encode(
                encodeSSE('task_event', {
                  type: event.type,
                  data: event.data,
                  createdAt: new Date().toISOString(),
                  taskId,
                })
              )
            );
          } catch {
            // ignore
          }
        })
      );

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
          unsubscribers.forEach((u) => u());
        }
      }, 15000);

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubscribers.forEach((u) => u());
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
