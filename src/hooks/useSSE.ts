'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
}

interface UseSSEOptions {
  onEvent?: (event: SSEEvent) => void;
  enabled?: boolean;
}

export function useSSE(taskId: string | null, options: UseSSEOptions = {}) {
  const { onEvent, enabled = true } = options;
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  const retryCountRef = useRef(0);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!taskId || !enabled) return;

    const es = new EventSource(`/api/tasks/${taskId}/events`);
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      setConnected(true);
      setReconnecting(false);
      retryCountRef.current = 0;
    });

    es.addEventListener('task_event', (e) => {
      try {
        const event: SSEEvent = JSON.parse(e.data);
        onEventRef.current?.(event);
      } catch {}
    });

    es.addEventListener('replay_complete', () => {});

    es.onerror = () => {
      setConnected(false);
      es.close();

      // Exponential backoff: 2s, 4s, 8s, max 15s
      const retryDelay = Math.min(2000 * Math.pow(2, retryCountRef.current), 15000);
      retryCountRef.current++;

      if (retryCountRef.current <= 10) {
        setReconnecting(true);
        setTimeout(() => connect(), retryDelay);
      } else {
        // Stop retrying after 10 attempts — rely on polling
        setReconnecting(false);
        console.warn('[SSE] Max retries reached, falling back to polling');
      }
    };

    return () => {
      es.close();
      setConnected(false);
      setReconnecting(false);
    };
  }, [taskId, enabled]);

  useEffect(() => {
    retryCountRef.current = 0;
    const cleanup = connect();
    return () => {
      cleanup?.();
      eventSourceRef.current?.close();
    };
  }, [connect]);

  return { connected, reconnecting };
}
