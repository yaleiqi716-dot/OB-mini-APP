// In-memory task queue. Single-process, no Redis.
// Tasks are enqueued by API, dequeued by worker.

interface QueueItem {
  taskId: string;
  input: string;
  presetType?: string;
  userId?: string;
  enqueuedAt: number;
}

const queue: QueueItem[] = [];

export function enqueue(item: QueueItem) {
  queue.push(item);
  console.log(`[QUEUE] Enqueued task ${item.taskId} (queue length: ${queue.length})`);
}

export function dequeue(): QueueItem | undefined {
  const item = queue.shift();
  if (item) {
    console.log(`[QUEUE] Dequeued task ${item.taskId} (queue length: ${queue.length})`);
  }
  return item;
}

export function getQueueLength(): number {
  return queue.length;
}

export function peekQueue(): QueueItem[] {
  return [...queue];
}
