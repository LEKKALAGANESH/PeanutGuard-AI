'use client';

import { useCallback } from 'react';
import { useBulkScanStore } from '@/stores/bulk-scan-store';
import { useBulkScan } from '@/hooks/useBulkScan';
import { useBatchExport } from '@/hooks/useBatchExport';
import type { BulkScanItem } from '@/types/desktop';

/**
 * Mobile batch scan progress & results view.
 * Shows vertically-stacked cards with scan status/results.
 */
export function PhoneBatchView() {
  const items = useBulkScanStore((s) => s.items);
  const stats = useBulkScanStore((s) => s.stats);
  const isProcessing = useBulkScanStore((s) => s.isProcessing);
  const clearAll = useBulkScanStore((s) => s.clearAll);
  const removeItem = useBulkScanStore((s) => s.removeItem);

  const { startBatch, togglePause, cancelBatch, isReady, isPaused } = useBulkScan();
  const { exportBatchPDF, exportCSV } = useBatchExport();

  const allDone =
    items.length > 0 &&
    !isProcessing &&
    items.every((i) => i.status === 'complete' || i.status === 'error' || i.status === 'skipped');

  const progress =
    stats.total > 0
      ? Math.round(((stats.completed + stats.failed + stats.skipped) / stats.total) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Progress header */}
      {isProcessing && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">
              Scanning {stats.completed + stats.failed}/{stats.total}
            </span>
            <span className="text-neutral-500">{progress}%</span>
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={togglePause}
              className="flex-1 rounded-xl border border-[var(--color-border)] py-2.5 text-sm font-medium active:bg-neutral-100 dark:active:bg-neutral-800"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={cancelBatch}
              className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 active:bg-red-50 dark:border-red-800 dark:text-red-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Summary banner */}
      {allDone && (
        <div className="rounded-2xl bg-green-50 p-4 dark:bg-green-950/30">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <span className="text-sm font-semibold text-green-800 dark:text-green-300">
              Batch Complete
            </span>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-white/60 p-2 dark:bg-white/5">
              <p className="text-lg font-bold text-green-600">{stats.healthy}</p>
              <p className="text-neutral-500">Healthy</p>
            </div>
            <div className="rounded-lg bg-white/60 p-2 dark:bg-white/5">
              <p className="text-lg font-bold text-amber-600">{stats.diseased}</p>
              <p className="text-neutral-500">Diseased</p>
            </div>
            <div className="rounded-lg bg-white/60 p-2 dark:bg-white/5">
              <p className="text-lg font-bold text-neutral-600">{stats.total}</p>
              <p className="text-neutral-500">Total</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => exportBatchPDF(items)}
              className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white active:bg-green-700"
            >
              Export PDF
            </button>
            <button
              onClick={() => exportCSV(items)}
              className="flex-1 rounded-xl border border-green-300 py-2.5 text-sm font-semibold text-green-700 active:bg-green-50 dark:border-green-800 dark:text-green-400"
            >
              Export CSV
            </button>
          </div>
        </div>
      )}

      {/* Start scan button */}
      {!isProcessing && !allDone && items.length > 0 && (
        <button
          onClick={startBatch}
          disabled={!isReady}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-green-600 text-base font-semibold text-white shadow-lg active:bg-green-700 disabled:opacity-40"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          Scan {items.length} Image{items.length !== 1 ? 's' : ''}
        </button>
      )}

      {/* Item cards */}
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <PhoneBatchCard key={item.id} item={item} onRemove={() => removeItem(item.id)} />
        ))}
      </div>

      {/* Clear all */}
      {items.length > 0 && !isProcessing && (
        <button
          onClick={clearAll}
          className="self-center text-sm text-neutral-400 active:text-neutral-600"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

function PhoneBatchCard({ item, onRemove }: { item: BulkScanItem; onRemove: () => void }) {
  const isProcessing = ['preprocessing', 'gate', 'classifying', 'detecting'].includes(item.status);
  const isComplete = item.status === 'complete';
  const isError = item.status === 'error';
  const top = item.result?.predictions[0];
  const isHealthy = isComplete && (!top || top.diseaseLabel === 'healthy');

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
        isError
          ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20'
          : isHealthy
            ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20'
            : isComplete
              ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20'
              : 'border-[var(--color-border)] bg-[var(--color-muted)]'
      }`}
    >
      {/* Thumbnail */}
      {item.thumbnail ? (
        <img src={item.thumbnail} alt="" className="h-12 w-12 rounded-lg object-cover" />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-200 dark:bg-neutral-700">
          {isProcessing ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
          ) : (
            <svg className="h-5 w-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91" />
            </svg>
          )}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 overflow-hidden">
        <p className="truncate text-sm font-medium">{item.fileName}</p>
        {isProcessing && (
          <p className="text-xs text-blue-600 dark:text-blue-400">
            {item.status === 'preprocessing'
              ? 'Preprocessing...'
              : item.status === 'gate'
                ? 'Checking crop...'
                : item.status === 'classifying'
                  ? 'Classifying...'
                  : 'Detecting lesions...'}
          </p>
        )}
        {isComplete && top && (
          <p className={`text-xs font-medium ${isHealthy ? 'text-green-600' : 'text-amber-600'}`}>
            {top.diseaseLabel.replace(/_/g, ' ')} &middot; {Math.round(top.confidence * 100)}%
          </p>
        )}
        {isError && (
          <p className="truncate text-xs text-red-500">{item.error ?? 'Failed'}</p>
        )}
        {item.status === 'queued' && (
          <p className="text-xs text-neutral-400">Queued</p>
        )}
        {item.status === 'skipped' && (
          <p className="text-xs text-neutral-400">Skipped</p>
        )}
      </div>

      {/* Severity dots (if complete and diseased) */}
      {isComplete && item.result && item.result.severityScore > 0 && (
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${
                i < item.result!.severityScore
                  ? item.result!.severityScore >= 4
                    ? 'bg-red-500'
                    : item.result!.severityScore >= 3
                      ? 'bg-amber-500'
                      : 'bg-yellow-500'
                  : 'bg-neutral-300 dark:bg-neutral-600'
              }`}
            />
          ))}
        </div>
      )}

      {/* Remove button */}
      {!isProcessing && (
        <button
          onClick={onRemove}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 active:bg-neutral-200 dark:active:bg-neutral-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
