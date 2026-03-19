'use client';

import Link from 'next/link';
import { useHistory } from '@/hooks/useHistory';
import { useScanStore } from '@/stores/scan-store';
import { useRouter } from 'next/navigation';

function SeverityDots({ level }: { level: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`inline-block h-2 w-2 rounded-full ${
            i < level
              ? level <= 2
                ? 'bg-green-500'
                : level <= 3
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              : 'bg-neutral-200 dark:bg-neutral-700'
          }`}
        />
      ))}
    </div>
  );
}

export default function HistoryPage() {
  const { scans, loading, error, deleteScan, totalCount } = useHistory();
  const router = useRouter();

  function handleScanClick(scan: typeof scans[0]) {
    // Load scan into store and navigate to result page
    useScanStore.getState().setCurrentResult({
      id: scan.id,
      timestamp: scan.timestamp,
      imageDataUrl: scan.imageDataUrl,
      predictions: scan.predictions,
      lesions: scan.lesions,
      severityScore: scan.severityScore,
      modelUsed: scan.modelUsed as 'mobilenetv3_large' | 'mobilenetv3_small',
    });
    router.push('/scan/result');
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold">Scan History</h1>
        {totalCount > 0 && (
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            {totalCount} scan{totalCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
        </div>
      ) : scans.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="text-5xl">📋</span>
          <div>
            <p className="text-base font-medium">No scans yet</p>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Your scan results will appear here
            </p>
          </div>
          <Link
            href="/scan"
            className="mt-2 rounded-full bg-green-600 px-6 py-2.5 text-sm font-medium text-white transition-colors active:bg-green-700"
          >
            Take First Scan
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {scans.map((scan) => {
            const topPrediction = scan.predictions?.[0];
            const diseaseName = topPrediction
              ? topPrediction.diseaseLabel.replace(/_/g, ' ')
              : 'Unknown';
            const confidence = topPrediction?.confidence ?? 0;

            return (
              <li key={scan.id}>
                <button
                  onClick={() => handleScanClick(scan)}
                  className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] p-3 text-left transition-colors active:bg-neutral-200 dark:active:bg-neutral-700"
                >
                  {/* Thumbnail */}
                  {scan.imageDataUrl ? (
                    <img
                      src={scan.imageDataUrl}
                      alt={diseaseName}
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-green-100 text-2xl dark:bg-green-900">
                      🥜
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-semibold capitalize">
                      {diseaseName}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {Math.round(confidence * 100)}%
                      </span>
                      <SeverityDots level={scan.severityScore ?? 0} />
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
                      {new Date(scan.timestamp).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteScan(scan.id);
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900"
                    aria-label="Delete scan"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>

                  {/* Chevron */}
                  <svg
                    className="h-5 w-5 shrink-0 text-neutral-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
