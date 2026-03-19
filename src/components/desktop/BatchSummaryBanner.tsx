'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useBulkScanStore } from '@/stores/bulk-scan-store';

interface BatchSummaryBannerProps {
  onExportAll: () => void;
  onClearBatch: () => void;
}

export function BatchSummaryBanner({
  onExportAll,
  onClearBatch,
}: BatchSummaryBannerProps) {
  const items = useBulkScanStore((s) => s.items);
  const stats = useBulkScanStore((s) => s.stats);
  const isProcessing = useBulkScanStore((s) => s.isProcessing);

  const allDone =
    items.length > 0 &&
    !isProcessing &&
    items.every(
      (i) =>
        i.status === 'complete' ||
        i.status === 'error' ||
        i.status === 'skipped',
    );

  return (
    <AnimatePresence>
      {allDone && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className="glass-elevated mx-4 mt-2 flex items-center justify-between rounded-xl px-5 py-3"
        >
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <span className="text-sm font-medium text-slate-200">
                Batch Complete
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span>
                <strong className="text-slate-200">{stats.total}</strong> total
              </span>
              <span>
                <strong className="text-emerald-400">{stats.healthy}</strong>{' '}
                healthy
              </span>
              <span>
                <strong className="text-amber-400">{stats.diseased}</strong>{' '}
                diseased
              </span>
              {stats.failed > 0 && (
                <span>
                  <strong className="text-red-400">{stats.failed}</strong>{' '}
                  failed
                </span>
              )}
              {stats.avgInferenceMs > 0 && (
                <span>
                  Avg: {Math.round(stats.avgInferenceMs)}ms
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onExportAll}
              className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-500"
            >
              Export All
            </button>
            <button
              onClick={onClearBatch}
              className="rounded-lg border border-slate-600 px-4 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700"
            >
              Clear Batch
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
