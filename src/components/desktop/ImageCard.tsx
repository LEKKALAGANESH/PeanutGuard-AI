'use client';

import type { BulkScanItem } from '@/types/desktop';

interface ImageCardProps {
  item: BulkScanItem;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  preprocessing: 'Preprocessing...',
  gate: 'Gate check...',
  classifying: 'Classifying...',
  detecting: 'Detecting...',
  complete: 'Complete',
  error: 'Error',
  skipped: 'Skipped',
};

export function ImageCard({
  item,
  isSelected,
  onClick,
  onContextMenu,
}: ImageCardProps) {
  const isProcessing = ['preprocessing', 'gate', 'classifying', 'detecting'].includes(
    item.status,
  );
  const isComplete = item.status === 'complete';
  const isError = item.status === 'error';
  const isSkipped = item.status === 'skipped';
  const isQueued = item.status === 'queued';

  const topPred = item.result?.predictions[0];
  const isHealthy =
    isComplete && (!topPred || topPred.diseaseLabel === 'healthy' || !item.result?.isPeanut);
  const isDiseased = isComplete && topPred && topPred.diseaseLabel !== 'healthy' && item.result?.isPeanut;

  // Border color based on state
  let borderClass = 'border-transparent';
  if (isSelected) borderClass = 'border-blue-500';
  else if (isHealthy) borderClass = 'border-green-500/50';
  else if (isDiseased) borderClass = 'border-amber-500/50';
  else if (isError) borderClass = 'border-red-500/50';

  // Glow animation class
  let glowClass = '';
  if (isHealthy && !isSelected) glowClass = 'pulse-glow-green';
  else if (isDiseased && !isSelected) glowClass = 'pulse-glow-amber';
  else if (isError) glowClass = 'pulse-glow-red';

  return (
    <div
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e);
      }}
      className={`glass-card relative cursor-pointer overflow-hidden border-2 ${borderClass} ${glowClass} transition-all hover:border-slate-500`}
    >
      {/* Selection checkbox */}
      {isSelected && (
        <div className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded bg-blue-500 text-xs text-white">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Thumbnail */}
      <div className="relative aspect-square overflow-hidden bg-slate-900">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.fileName}
            className={`h-full w-full object-cover ${isSkipped ? 'opacity-40 grayscale' : ''}`}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl text-slate-700">
            {isQueued ? (
              <svg className="h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : isError ? (
              <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
              </svg>
            ) : (
              <svg className="h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
            )}
          </div>
        )}

        {/* Processing shimmer overlay */}
        {isProcessing && (
          <div className="shimmer-scan absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-medium text-blue-300">
              {STATUS_LABELS[item.status]}
            </span>
          </div>
        )}
      </div>

      {/* Info bar */}
      <div className="px-2.5 py-2">
        <p className={`truncate text-xs font-medium ${isSkipped ? 'text-slate-600 line-through' : 'text-slate-300'}`}>
          {item.fileName}
        </p>

        {isComplete && topPred && (
          <div className="mt-1 flex items-center justify-between">
            <span
              className={`truncate text-[10px] font-medium ${
                isHealthy ? 'text-green-400' : 'text-amber-400'
              }`}
            >
              {topPred.diseaseLabel.replace(/_/g, ' ')}
            </span>
            <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
              {Math.round(topPred.confidence * 100)}%
            </span>
          </div>
        )}

        {isComplete && item.result && item.result.severityScore > 0 && (
          <div className="mt-1 flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${
                  i < item.result!.severityScore
                    ? item.result!.severityScore >= 4
                      ? 'bg-red-500'
                      : item.result!.severityScore >= 3
                        ? 'bg-amber-500'
                        : 'bg-yellow-500'
                    : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
        )}

        {isError && (
          <p className="mt-1 truncate text-[10px] text-red-400">
            {item.error ?? 'Scan failed'}
          </p>
        )}

        {isQueued && (
          <p className="mt-1 text-[10px] text-slate-600">
            #{item.queuePosition + 1} in queue
          </p>
        )}
      </div>
    </div>
  );
}
