'use client';

import { useCallback, useRef, useState } from 'react';
import { useBulkScanStore } from '@/stores/bulk-scan-store';
import { useWorkerPool } from './useWorkerPool';
import { getCurrentPosition } from '@/lib/geo/geolocation';
import { fetchWeather } from '@/lib/weather/open-meteo';
import { calculateRisk } from '@/lib/risk/environmental-risk';
import type { BulkScanStatus, BulkScanResult, WeatherData } from '@/types/desktop';

/** Demo result returned when ONNX models are not available */
function createDemoBulkResult(): BulkScanResult {
  return {
    isPeanut: true,
    peanutConfidence: 0.95,
    predictions: [
      { diseaseLabel: 'early_leaf_spot', confidence: 0.87 },
      { diseaseLabel: 'late_leaf_spot', confidence: 0.08 },
      { diseaseLabel: 'healthy', confidence: 0.03 },
    ],
    lesions: [
      { x: 0.2, y: 0.3, width: 0.25, height: 0.2, confidence: 0.92 },
    ],
    severityScore: 3,
    modelUsed: 'mobilenetv3_large',
    inferenceMs: 0,
  };
}

export function useBulkScan() {
  const store = useBulkScanStore();
  const cancelledRef = useRef(false);
  const [isDemo, setIsDemo] = useState(false);

  const onProgress = useCallback(
    (id: string, phase: BulkScanStatus) => {
      store.updateItem(id, { status: phase });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const { submit, isReady, metrics, pause, resume, terminate } =
    useWorkerPool(onProgress);

  const startBatch = useCallback(async () => {
    cancelledRef.current = false;
    store.startBatch();

    // Optional: get GPS + weather
    let weather: WeatherData | null = null;
    try {
      const geo = await getCurrentPosition();
      if (geo) {
        weather = await fetchWeather(geo.lat, geo.lng);
      }
    } catch {
      // GPS/weather is optional
    }

    const items = useBulkScanStore.getState().items;
    const queued = items.filter((i) => i.status === 'queued');

    for (const item of queued) {
      if (cancelledRef.current) break;

      // Wait while paused
      while (useBulkScanStore.getState().isPaused) {
        await new Promise((r) => setTimeout(r, 200));
        if (cancelledRef.current) break;
      }
      if (cancelledRef.current) break;

      store.updateItem(item.id, { status: 'preprocessing', startTime: performance.now() });

      try {
        const buffer = await item.file.arrayBuffer();
        const response = await submit(item.id, buffer);

        // Calculate environmental risk
        let envRisks;
        if (response.result.predictions.length > 0) {
          envRisks = calculateRisk(response.result.predictions, weather);
        }

        store.updateItem(item.id, {
          status: 'complete',
          result: {
            ...response.result,
            environmentalRisks: envRisks,
          },
          thumbnail: response.thumbnail,
          endTime: performance.now(),
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isModelError = errMsg.includes('fetch') || errMsg.includes('model') || errMsg.includes('ONNX') || errMsg.includes('Worker');

        if (isModelError) {
          // Models not available — fall back to demo mode for this and all remaining items
          setIsDemo(true);
          store.updateItem(item.id, {
            status: 'complete',
            result: createDemoBulkResult(),
            endTime: performance.now(),
          });
        } else {
          store.updateItem(item.id, {
            status: 'error',
            error: errMsg,
            endTime: performance.now(),
          });
        }
      }

      store.recalculateStats();
    }

    // Check if batch fully done
    const finalItems = useBulkScanStore.getState().items;
    const allDone = finalItems.every(
      (i) => i.status === 'complete' || i.status === 'error' || i.status === 'skipped',
    );
    if (allDone) {
      useBulkScanStore.setState({ isProcessing: false });

      // Persist completed results to IndexedDB
      try {
        const { saveBatchResults } = await import('@/lib/db/batch-repository');
        await saveBatchResults(finalItems);
      } catch {
        // IndexedDB persistence is non-critical for batch mode
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submit]);

  const cancelBatch = useCallback(() => {
    cancelledRef.current = true;
    terminate();

    // Mark remaining queued items as skipped
    const items = useBulkScanStore.getState().items;
    for (const item of items) {
      if (item.status === 'queued' || item.status === 'preprocessing') {
        store.updateItem(item.id, { status: 'skipped' });
      }
    }
    useBulkScanStore.setState({ isProcessing: false, isPaused: false });
    store.recalculateStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminate]);

  const togglePause = useCallback(() => {
    const state = useBulkScanStore.getState();
    if (state.isPaused) {
      store.resumeBatch();
      resume();
    } else {
      store.pauseBatch();
      pause();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pause, resume]);

  return {
    startBatch,
    cancelBatch,
    togglePause,
    isReady,
    isDemo,
    isProcessing: store.isProcessing,
    isPaused: store.isPaused,
    metrics,
  };
}
