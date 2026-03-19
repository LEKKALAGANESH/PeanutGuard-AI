'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { WorkerPool } from '@/lib/workers/worker-pool';
import type { BulkScanStatus, WorkerResponse } from '@/types/desktop';

interface WorkerPoolMetrics {
  activeWorkers: number;
  idleWorkers: number;
  queueLength: number;
  totalProcessed: number;
  avgLatencyMs: number;
}

export function useWorkerPool(
  onProgress?: (id: string, phase: BulkScanStatus) => void,
) {
  const poolRef = useRef<WorkerPool | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<WorkerPoolMetrics>({
    activeWorkers: 0,
    idleWorkers: 0,
    queueLength: 0,
    totalProcessed: 0,
    avgLatencyMs: 0,
  });

  useEffect(() => {
    const pool = new WorkerPool();
    poolRef.current = pool;

    pool.init(undefined, onProgress).then(() => {
      setIsReady(true);
      setError(null);
    }).catch((err) => {
      setError(
        err instanceof Error
          ? `Worker pool failed to initialize: ${err.message}`
          : 'Worker pool failed to initialize — Web Workers may not be supported'
      );
    });

    // Refresh metrics at 500ms interval
    const intervalId = setInterval(() => {
      if (poolRef.current?.isReady) {
        setMetrics(poolRef.current.getMetrics());
      }
    }, 500);

    return () => {
      clearInterval(intervalId);
      pool.terminate();
      poolRef.current = null;
      setIsReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = useCallback(
    (id: string, imageBuffer: ArrayBuffer) => {
      if (!poolRef.current) {
        return Promise.reject(new Error('WorkerPool not initialized'));
      }
      return poolRef.current.submit(id, imageBuffer);
    },
    [],
  );

  const pause = useCallback(() => poolRef.current?.pause(), []);
  const resume = useCallback(() => poolRef.current?.resume(), []);
  const terminate = useCallback(() => poolRef.current?.terminate(), []);

  return { submit, isReady, error, metrics, pause, resume, terminate };
}
