import type { BulkScanStatus, BulkScanResult, WorkerResponse } from '@/types/desktop';

interface PendingTask {
  id: string;
  imageBuffer: ArrayBuffer;
  resolve: (response: WorkerResponse & { type: 'result' }) => void;
  reject: (error: Error) => void;
}

interface WorkerState {
  worker: Worker;
  busy: boolean;
  currentTaskId: string | null;
  totalProcessed: number;
  totalLatencyMs: number;
}

export class WorkerPool {
  private workers: WorkerState[] = [];
  private queue: PendingTask[] = [];
  private ready = false;
  private paused = false;
  private onProgress?: (id: string, phase: BulkScanStatus) => void;

  async init(
    numWorkers?: number,
    onProgress?: (id: string, phase: BulkScanStatus) => void,
  ): Promise<void> {
    this.onProgress = onProgress;
    const count = numWorkers ?? Math.min(
      (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4) - 1,
      4,
    );

    const initPromises: Promise<void>[] = [];

    for (let i = 0; i < Math.max(1, count); i++) {
      const worker = new Worker(
        new URL('./inference-worker.ts', import.meta.url),
        { type: 'module' },
      );

      const state: WorkerState = {
        worker,
        busy: false,
        currentTaskId: null,
        totalProcessed: 0,
        totalLatencyMs: 0,
      };

      this.workers.push(state);

      const initP = new Promise<void>((resolve) => {
        const handler = (e: MessageEvent) => {
          if (e.data.type === 'ready') {
            worker.removeEventListener('message', handler);
            resolve();
          }
        };
        worker.addEventListener('message', handler);
        worker.postMessage({ type: 'init' });
      });

      initPromises.push(initP);
    }

    await Promise.all(initPromises);
    this.ready = true;
  }

  submit(id: string, imageBuffer: ArrayBuffer): Promise<WorkerResponse & { type: 'result' }> {
    return new Promise((resolve, reject) => {
      this.queue.push({ id, imageBuffer, resolve, reject });
      this.dispatch();
    });
  }

  getMetrics() {
    const active = this.workers.filter((w) => w.busy).length;
    const totalProcessed = this.workers.reduce((s, w) => s + w.totalProcessed, 0);
    const totalLatency = this.workers.reduce((s, w) => s + w.totalLatencyMs, 0);

    return {
      activeWorkers: active,
      idleWorkers: this.workers.length - active,
      queueLength: this.queue.length,
      totalProcessed,
      avgLatencyMs: totalProcessed > 0 ? totalLatency / totalProcessed : 0,
    };
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.dispatch();
  }

  terminate(): void {
    for (const state of this.workers) {
      state.worker.postMessage({ type: 'dispose' });
      state.worker.terminate();
    }
    this.workers = [];
    this.queue = [];
    this.ready = false;
  }

  get isReady(): boolean {
    return this.ready;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private dispatch(): void {
    if (this.paused || this.queue.length === 0) return;

    const idleWorker = this.workers.find((w) => !w.busy);
    if (!idleWorker) return;

    const task = this.queue.shift()!;
    this.assignTask(idleWorker, task);
  }

  private assignTask(state: WorkerState, task: PendingTask): void {
    state.busy = true;
    state.currentTaskId = task.id;
    const startTime = performance.now();

    const handler = (e: MessageEvent) => {
      const msg = e.data as WorkerResponse;

      if (msg.type === 'progress' && 'id' in msg && msg.id === task.id) {
        this.onProgress?.(task.id, msg.phase);
        return;
      }

      if (msg.type === 'result' && 'id' in msg && msg.id === task.id) {
        state.worker.removeEventListener('message', handler);
        state.busy = false;
        state.currentTaskId = null;

        const elapsed = performance.now() - startTime;
        state.totalProcessed++;
        state.totalLatencyMs += elapsed;

        // Attach timing to result
        const result = msg as WorkerResponse & { type: 'result' };
        (result.result as BulkScanResult).inferenceMs = elapsed;

        task.resolve(result);
        this.dispatch(); // process next in queue
        return;
      }

      if (msg.type === 'error' && 'id' in msg && msg.id === task.id) {
        state.worker.removeEventListener('message', handler);
        state.busy = false;
        state.currentTaskId = null;
        task.reject(new Error('error' in msg ? (msg as { error: string }).error : 'Worker error'));
        this.dispatch();
      }
    };

    state.worker.addEventListener('message', handler);

    // Transfer the buffer (zero-copy) to the worker
    state.worker.postMessage(
      { type: 'infer', id: task.id, imageBuffer: task.imageBuffer },
      [task.imageBuffer],
    );
  }
}
