type EventCallback = (event: { type: string; data: unknown }) => void;

class EventBus {
  private subscribers = new Map<string, Set<EventCallback>>();

  subscribe(taskId: string, callback: EventCallback): () => void {
    if (!this.subscribers.has(taskId)) {
      this.subscribers.set(taskId, new Set());
    }
    this.subscribers.get(taskId)!.add(callback);

    return () => {
      const subs = this.subscribers.get(taskId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(taskId);
        }
      }
    };
  }

  publish(taskId: string, event: { type: string; data: unknown }) {
    const subs = this.subscribers.get(taskId);
    if (subs) {
      subs.forEach((cb) => {
        try {
          cb(event);
        } catch (err) {
          console.error('EventBus callback error:', err);
        }
      });
    }
  }

  hasSubscribers(taskId: string): boolean {
    return (this.subscribers.get(taskId)?.size ?? 0) > 0;
  }
}

// Singleton for the process
const globalForEventBus = globalThis as unknown as { eventBus: EventBus };
export const eventBus = globalForEventBus.eventBus || new EventBus();
if (process.env.NODE_ENV !== 'production') globalForEventBus.eventBus = eventBus;
