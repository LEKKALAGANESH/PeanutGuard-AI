import { db, type ScanRecord } from './index';
import type { BulkScanItem, BatchStats } from '@/types/desktop';

/**
 * Save completed bulk scan items as individual ScanRecords in IndexedDB.
 */
export async function saveBatchResults(items: BulkScanItem[]): Promise<void> {
  const records: ScanRecord[] = items
    .filter((item) => item.status === 'complete' && item.result)
    .map((item) => ({
      id: item.id,
      timestamp: item.endTime ?? Date.now(),
      imageDataUrl: item.thumbnail ?? '',
      predictions: item.result!.predictions.map((p) => ({
        diseaseLabel: p.diseaseLabel,
        confidence: p.confidence,
      })),
      lesions: item.result!.lesions.map((l) => ({
        x: l.x,
        y: l.y,
        width: l.width,
        height: l.height,
        confidence: l.confidence,
      })),
      severityScore: item.result!.severityScore,
      modelUsed: item.result!.modelUsed,
      synced: false,
    }));

  await db.scans.bulkAdd(records);
}

/**
 * Compute summary statistics for a batch of scan items.
 */
export function getBatchSummary(items: BulkScanItem[]): BatchStats {
  const completed = items.filter((i) => i.status === 'complete');
  const failed = items.filter((i) => i.status === 'error').length;
  const skipped = items.filter((i) => i.status === 'skipped').length;

  let healthy = 0;
  let diseased = 0;
  let totalConfidence = 0;
  let totalInferenceMs = 0;
  const diseaseDistribution: Record<string, number> = {};

  for (const item of completed) {
    if (!item.result) continue;
    const top = item.result.predictions[0];

    if (!top || top.diseaseLabel === 'healthy' || !item.result.isPeanut) {
      healthy++;
    } else {
      diseased++;
      diseaseDistribution[top.diseaseLabel] =
        (diseaseDistribution[top.diseaseLabel] ?? 0) + 1;
    }

    totalConfidence += top?.confidence ?? 0;
    totalInferenceMs += item.result.inferenceMs;
  }

  return {
    total: items.length,
    completed: completed.length,
    healthy,
    diseased,
    failed,
    skipped,
    avgConfidence: completed.length > 0 ? totalConfidence / completed.length : 0,
    avgInferenceMs: completed.length > 0 ? totalInferenceMs / completed.length : 0,
    diseaseDistribution,
  };
}
