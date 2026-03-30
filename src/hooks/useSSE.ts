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
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!taskId || !enabled) return;

    const es = new EventSource(`/api/tasks/${taskId}/events`);
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      setConnected(true);
    });

    es.addEventListener('task_event', (e) => {
      try {
        const event: SSEEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev, event]);
        onEventRef.current?.(event);
      } catch {}
    });

    es.addEventListener('replay_complete', () => {
      // Replay done, now receiving live events
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      // Reconnect after 2 seconds
      setTimeout(() => connect(), 2000);
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [taskId, enabled]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
      eventSourceRef.current?.close();
    };
  }, [connect]);

  const reset = useCallback(() => {
    setEvents([]);
  }, []);

  return { connected, events, reset };
}
