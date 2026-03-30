export function encodeSSE(event: string, data: unknown): string {
  const json = JSON.stringify(data);
  return `event: ${event}\ndata: ${json}\n\n`;
}

export function createSSEStream(
  onCancel: () => void
): { stream: ReadableStream; push: (event: string, data: unknown) => void } {
  let controller: ReadableStreamDefaultController | null = null;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
    },
    cancel() {
      onCancel();
    },
  });

  function push(event: string, data: unknown) {
    if (controller) {
      try {
        controller.enqueue(encoder.encode(encodeSSE(event, data)));
      } catch {
        // Stream may be closed
      }
    }
  }

  return { stream, push };
}

export function sseHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  };
}
