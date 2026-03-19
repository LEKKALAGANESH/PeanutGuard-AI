import { supabase } from './client';
import { scanRepository } from '@/lib/db/scan-repository';

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if the device is online.
 */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.onLine;
}

/**
 * Sync unsynced scan metadata to Supabase.
 * Called periodically when device is online.
 * Uploads only metadata (~2KB per scan), never images.
 */
export async function syncScans(): Promise<{ synced: number; failed: number }> {
  if (!isOnline()) {
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;

  try {
    const unsyncedScans = await scanRepository.getUnsynced();

    for (const scan of unsyncedScans) {
      try {
        // Insert scan metadata into the scans table
        const { error: scanError } = await supabase.from('scans').insert({
          id: scan.id,
          field_id: scan.fieldId ?? null,
          image_type: 'leaf',
          device_ram_gb: null,
          created_at: new Date(scan.timestamp).toISOString(),
        });

        if (scanError) {
          failed++;
          continue;
        }

        // Insert scan results (predictions)
        if (scan.predictions && scan.predictions.length > 0) {
          const resultRows = scan.predictions.map((p) => ({
            scan_id: scan.id,
            disease_label: p.diseaseLabel,
            confidence: p.confidence,
            severity: scan.severityScore,
            affected_area_pct: null,
            lesion_count: scan.lesions?.length ?? 0,
            model_used: scan.modelUsed,
          }));

          const { error: resultsError } = await supabase
            .from('scan_results')
            .insert(resultRows);

          if (resultsError) {
            failed++;
            continue;
          }
        }

        // Mark as synced in IndexedDB
        await scanRepository.markSynced(scan.id);
        synced++;
      } catch {
        failed++;
      }
    }
  } catch {
    return { synced, failed };
  }

  return { synced, failed };
}

/**
 * Register a periodic sync check.
 * Runs every 5 minutes when online.
 * Returns a cleanup function that clears the interval.
 */
export function startBackgroundSync(): () => void {
  syncScans().catch(() => {
    // Silently ignore — will retry on next interval
  });

  const intervalId = setInterval(() => {
    syncScans().catch(() => {
      // Silently ignore — will retry on next interval
    });
  }, SYNC_INTERVAL_MS);

  return () => {
    clearInterval(intervalId);
  };
}
