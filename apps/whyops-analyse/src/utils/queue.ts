import { EventEmitter } from 'events';

type Task = () => Promise<any>;

export class AsyncQueue {
  private queue: Task[] = [];
  private running = false;

  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.running) return;
    this.running = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        try {
          await task();
        } catch (e) {
          console.error('Queue task failed', e);
        }
      }
    }

    this.running = false;
  }
}

export class TraceQueueManager {
  private queues: Map<string, AsyncQueue> = new Map();

  getQueue(traceId: string): AsyncQueue {
    if (!this.queues.has(traceId)) {
      this.queues.set(traceId, new AsyncQueue());
    }
    return this.queues.get(traceId)!;
  }
  
  // Optional: Clean up empty queues to prevent memory leaks
  cleanup() {
    // Implementation left for later, simple LRU or timeout
  }
}

export const traceQueue = new TraceQueueManager();
