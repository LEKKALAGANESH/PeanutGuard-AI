'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { useBulkScanStore } from '@/stores/bulk-scan-store';
import { useDesktopUIStore } from '@/stores/desktop-ui-store';
import { useBulkScan } from '@/hooks/useBulkScan';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useBatchExport } from '@/hooks/useBatchExport';
import { DesktopTopBar } from '@/components/desktop/DesktopTopBar';
import { DesktopStatusBar } from '@/components/desktop/DesktopStatusBar';
import { BulkDropZone } from '@/components/desktop/BulkDropZone';
import { BulkImageGrid } from '@/components/desktop/BulkImageGrid';
import { BatchSidebar } from '@/components/desktop/BatchSidebar';
import { BatchSummaryBanner } from '@/components/desktop/BatchSummaryBanner';
import { ZoomHeatmap } from '@/components/desktop/ZoomHeatmap';
import { ComparisonPanel } from '@/components/desktop/ComparisonPanel';
import { PhoneDropZone } from '@/components/scan/PhoneDropZone';
import { PhoneBatchView } from '@/components/scan/PhoneBatchView';
import '@/styles/glassmorphism.css';

// ---------------------------------------------------------------------------
// Mobile home view — Phone Premium UI
// ---------------------------------------------------------------------------

function useRecentScans() {
  const [scans, setScans] = useState<Array<{ id: string; diseaseName: string; confidence: number; thumbnail: string; date: string }>>([]);
  const [totalScans, setTotalScans] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadScans() {
      try {
        const { scanRepository } = await import('@/lib/db/scan-repository');
        const [recent, count] = await Promise.all([
          scanRepository.getRecent(3),
          scanRepository.count(),
        ]);
        setTotalScans(count);
        setScans(
          recent.map((r) => ({
            id: r.id,
            diseaseName: r.predictions?.[0]?.diseaseLabel?.replace(/_/g, ' ') ?? 'Unknown',
            confidence: r.predictions?.[0]?.confidence ?? 0,
            thumbnail: r.imageDataUrl ?? '',
            date: new Date(r.timestamp).toISOString(),
          }))
        );
      } catch {
        // DB unavailable — show empty state
      } finally {
        setLoading(false);
      }
    }
    loadScans();
  }, []);

  return { scans, totalScans, loading };
}

function useFieldCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    import('@/lib/db/field-repository').then(({ fieldRepository }) => {
      fieldRepository.getAll().then((fields) => setCount(fields.length)).catch(() => {});
    }).catch(() => {});
  }, []);
  return count;
}

function MobileHome() {
  const { scans, totalScans, loading } = useRecentScans();
  const fieldCount = useFieldCount();
  const bulkItems = useBulkScanStore((s) => s.items);
  const addFiles = useBulkScanStore((s) => s.addFiles);
  const hasBulkItems = bulkItems.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Hero / Branding */}
      <section className="flex flex-col items-center gap-2 pt-6 pb-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-600 text-2xl shadow-lg shadow-green-600/20">
          🥜
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-green-700 dark:text-green-400">
          PeanutGuard AI
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Detect diseases. Optimize harvest. 100% on-device.
        </p>
      </section>

      {/* Scan Button */}
      <Link
        href="/scan"
        className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-green-600 text-base font-semibold text-white shadow-lg shadow-green-600/25 transition-colors active:bg-green-700"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
          />
        </svg>
        Scan Crop
      </Link>

      {/* Batch scan section */}
      {hasBulkItems ? (
        <PhoneBatchView />
      ) : (
        <PhoneDropZone onFiles={addFiles} />
      )}

      {/* Quick Stats */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-center">
            <p className="text-2xl font-bold text-green-600 sm:text-3xl">{totalScans}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 sm:text-sm">
              Total Scans
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-center">
            <p className="text-2xl font-bold text-green-600 sm:text-3xl">{fieldCount}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 sm:text-sm">
              Fields
            </p>
          </div>
          <div className="hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-center sm:block">
            <p className="text-2xl font-bold text-green-600 sm:text-3xl">0</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 sm:text-sm">
              Alerts
            </p>
          </div>
          <div className="hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-center sm:block">
            <p className="text-2xl font-bold text-green-600 sm:text-3xl">--</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 sm:text-sm">
              Harvest Ready
            </p>
          </div>
        </div>
      )}

      {/* Recent Scans */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent Scans</h2>
          {scans.length > 0 && (
            <Link
              href="/history"
              className="text-sm font-medium text-green-600"
            >
              View All
            </Link>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
          </div>
        ) : scans.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] py-10 text-center">
            <span className="text-3xl">🌱</span>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Take your first scan to get started
            </p>
            <Link
              href="/scan"
              className="rounded-full bg-green-600 px-5 py-2 text-sm font-medium text-white transition-colors active:bg-green-700"
            >
              Start Scanning
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {scans.map((scan) => (
              <li key={scan.id}>
                <Link
                  href={`/history/${scan.id}`}
                  className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] p-3 transition-colors active:bg-neutral-200 dark:active:bg-neutral-700"
                >
                  {scan.thumbnail ? (
                    <img
                      src={scan.thumbnail}
                      alt={scan.diseaseName}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-xl dark:bg-green-900">
                      🥜
                    </div>
                  )}
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium">
                      {scan.diseaseName}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {new Date(scan.date).toLocaleDateString()} &middot;{' '}
                      {Math.round(scan.confidence * 100)}% confidence
                    </p>
                  </div>
                  <svg
                    className="h-5 w-5 shrink-0 text-neutral-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* View All Link */}
      {scans.length > 0 && (
        <Link
          href="/history"
          className="flex h-12 items-center justify-center rounded-xl border border-[var(--color-border)] text-sm font-medium text-green-600 transition-colors active:bg-[var(--color-muted)]"
        >
          View All Scans
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop premium view (shown on lg+ screens)
// ---------------------------------------------------------------------------

function DesktopPremiumView() {
  const items = useBulkScanStore((s) => s.items);
  const clearAll = useBulkScanStore((s) => s.clearAll);
  const removeItem = useBulkScanStore((s) => s.removeItem);

  const selectedIds = useDesktopUIStore((s) => s.selectedIds);
  const comparisonPair = useDesktopUIStore((s) => s.comparisonPair);
  const zoomTargetId = useDesktopUIStore((s) => s.zoomTargetId);
  const inspectorOpen = useDesktopUIStore((s) => s.inspectorOpen);
  const deselectAll = useDesktopUIStore((s) => s.deselectAll);

  const { startBatch, togglePause, isReady, metrics } = useBulkScan();
  const { exportBatchPDF, exportCSV } = useBatchExport();

  const handleExportAll = useCallback(() => {
    exportBatchPDF(items);
  }, [exportBatchPDF, items]);

  const handleExportCSV = useCallback(() => {
    exportCSV(items);
  }, [exportCSV, items]);

  useKeyboardShortcuts({
    onToggleBatch: togglePause,
    onDeleteSelected: () => {
      for (const id of selectedIds) {
        removeItem(id);
      }
      deselectAll();
    },
    onDeselectAll: deselectAll,
  });

  const hasItems = items.length > 0;
  const showInspector = inspectorOpen && (zoomTargetId || comparisonPair);

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <DesktopTopBar
        onStartScan={startBatch}
        onTogglePause={togglePause}
        onExportAll={handleExportAll}
        isReady={isReady}
      />

      <BatchSummaryBanner
        onExportAll={handleExportAll}
        onClearBatch={clearAll}
      />

      <div className="flex min-h-0 flex-1">
        {hasItems && (
          <BatchSidebar
            onExportPDF={handleExportAll}
            onExportCSV={handleExportCSV}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {hasItems ? <BulkImageGrid /> : <BulkDropZone />}
        </div>

        {showInspector && (
          <aside className="glass-sidebar w-[380px] shrink-0 border-l border-slate-800">
            {comparisonPair ? <ComparisonPanel /> : <ZoomHeatmap />}
          </aside>
        )}
      </div>

      <DesktopStatusBar metrics={metrics} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Responsive home page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return <DesktopPremiumView />;
  }

  return <MobileHome />;
}
