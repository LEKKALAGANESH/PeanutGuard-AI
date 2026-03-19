'use client';

import { useBulkScanStore } from '@/stores/bulk-scan-store';

interface DesktopTopBarProps {
  onStartScan: () => void;
  onTogglePause: () => void;
  onExportAll: () => void;
  isReady: boolean;
}

export function DesktopTopBar({
  onStartScan,
  onTogglePause,
  onExportAll,
  isReady,
}: DesktopTopBarProps) {
  const isProcessing = useBulkScanStore((s) => s.isProcessing);
  const isPaused = useBulkScanStore((s) => s.isPaused);
  const itemCount = useBulkScanStore((s) => s.items.length);
  const hasItems = itemCount > 0;

  return (
    <header className="glass-panel flex h-14 shrink-0 items-center justify-between px-5">
      {/* Left: branding */}
      <div className="flex items-center gap-3">
        <span className="text-base font-bold text-green-400">
          PeanutGuard AI
        </span>
        <span className="rounded-full bg-green-900/60 px-2.5 py-0.5 text-xs font-medium text-green-300">
          Desktop Premium
        </span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {isProcessing ? (
          <>
            <button
              onClick={onTogglePause}
              className="rounded-lg border border-slate-600 px-4 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={onExportAll}
              className="rounded-lg border border-slate-600 px-4 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
            >
              Export All
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onStartScan}
              disabled={!hasItems || !isReady}
              className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start Scan
            </button>
            {hasItems && (
              <button
                onClick={onExportAll}
                className="rounded-lg border border-slate-600 px-4 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
              >
                Export All
              </button>
            )}
          </>
        )}
      </div>
    </header>
  );
}
