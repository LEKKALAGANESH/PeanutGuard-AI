'use client';

import { useBulkScanStore } from '@/stores/bulk-scan-store';

interface DesktopStatusBarProps {
  metrics: {
    activeWorkers: number;
    idleWorkers: number;
    queueLength: number;
    totalProcessed: number;
    avgLatencyMs: number;
  };
}

export function DesktopStatusBar({ metrics }: DesktopStatusBarProps) {
  const stats = useBulkScanStore((s) => s.stats);
  const isProcessing = useBulkScanStore((s) => s.isProcessing);

  const totalWorkers = metrics.activeWorkers + metrics.idleWorkers;
  const progress =
    stats.total > 0
      ? Math.round(
          ((stats.completed + stats.failed + stats.skipped) / stats.total) * 100,
        )
      : 0;

  // Throughput calculation
  const throughput =
    metrics.avgLatencyMs > 0
      ? (1000 / metrics.avgLatencyMs) * metrics.activeWorkers
      : 0;

  // ETA
  const remaining = stats.total - stats.completed - stats.failed - stats.skipped;
  const etaSeconds =
    throughput > 0 ? remaining / throughput : 0;

  // RAM usage (Chrome only)
  const ramMB =
    typeof performance !== 'undefined' &&
    'memory' in performance &&
    (performance as unknown as { memory: { usedJSHeapSize: number } }).memory
      ? Math.round(
          (performance as unknown as { memory: { usedJSHeapSize: number } }).memory
            .usedJSHeapSize /
            1024 /
            1024,
        )
      : null;

  return (
    <footer className="glass-panel flex h-8 shrink-0 items-center justify-between px-5 text-xs text-slate-400">
      {/* Left: worker dots */}
      <div className="flex items-center gap-3">
        <span className="text-slate-500">Workers:</span>
        <div className="flex items-center gap-1">
          {Array.from({ length: totalWorkers }).map((_, i) => (
            <div
              key={i}
              className={`status-dot ${
                i < metrics.activeWorkers
                  ? 'status-dot-active'
                  : 'status-dot-idle'
              }`}
            />
          ))}
        </div>
        <span>{metrics.activeWorkers}/{totalWorkers} active</span>
      </div>

      {/* Center: progress */}
      {isProcessing && (
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span>{progress}%</span>
          <span className="text-slate-500">|</span>
          <span>{throughput.toFixed(1)} img/s</span>
          {remaining > 0 && etaSeconds > 0 && (
            <>
              <span className="text-slate-500">|</span>
              <span>ETA: {formatTime(etaSeconds)}</span>
            </>
          )}
        </div>
      )}

      {/* Right: stats */}
      <div className="flex items-center gap-3">
        {metrics.totalProcessed > 0 && (
          <span>
            Avg: {Math.round(metrics.avgLatencyMs)}ms
          </span>
        )}
        <span>Queue: {metrics.queueLength}</span>
        {ramMB !== null && <span>RAM: {ramMB}MB</span>}
      </div>
    </footer>
  );
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m}m ${s}s`;
}
