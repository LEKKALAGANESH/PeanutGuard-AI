'use client';

import { useRef, useState, useCallback } from 'react';
import { useDesktopUIStore } from '@/stores/desktop-ui-store';
import { useBulkScanStore } from '@/stores/bulk-scan-store';
import { useImageZoom } from '@/hooks/useImageZoom';
import type { ComparisonMode } from '@/types/desktop';

export function ComparisonPanel() {
  const comparisonPair = useDesktopUIStore((s) => s.comparisonPair);
  const comparisonMode = useDesktopUIStore((s) => s.comparisonMode);
  const setComparisonMode = useDesktopUIStore((s) => s.setComparisonMode);
  const closeComparison = useDesktopUIStore((s) => s.closeComparison);
  const items = useBulkScanStore((s) => s.items);

  const [overlayOpacity, setOverlayOpacity] = useState(0.5);
  const [sliderPos, setSliderPos] = useState(50);
  const sliderRef = useRef<HTMLDivElement>(null);
  const { scale, offset, handlers } = useImageZoom();

  if (!comparisonPair) return null;

  const [id1, id2] = comparisonPair;
  const item1 = items.find((i) => i.id === id1);
  const item2 = items.find((i) => i.id === id2);

  if (!item1 || !item2) return null;

  const modes: { key: ComparisonMode; label: string }[] = [
    { key: 'side_by_side', label: 'Side by Side' },
    { key: 'overlay', label: 'Overlay' },
    { key: 'slider', label: 'Slider' },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          {modes.map((m) => (
            <button
              key={m.key}
              onClick={() => setComparisonMode(m.key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                comparisonMode === m.key
                  ? 'bg-green-900/50 text-green-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button
          onClick={closeComparison}
          className="rounded-md p-1 text-slate-500 transition-colors hover:text-slate-200"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-4" {...handlers}>
        {comparisonMode === 'side_by_side' && (
          <div className="flex h-full gap-2">
            <CompareImage
              item={item1}
              scale={scale}
              offset={offset}
              label="A"
            />
            <CompareImage
              item={item2}
              scale={scale}
              offset={offset}
              label="B"
            />
          </div>
        )}

        {comparisonMode === 'overlay' && (
          <div className="relative h-full">
            <CompareImage
              item={item1}
              scale={scale}
              offset={offset}
              label="A"
            />
            <div
              className="absolute inset-0"
              style={{ opacity: overlayOpacity }}
            >
              <CompareImage
                item={item2}
                scale={scale}
                offset={offset}
                label="B"
              />
            </div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <div className="glass-elevated flex items-center gap-3 rounded-lg px-4 py-2">
                <span className="text-xs text-slate-400">Opacity</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={overlayOpacity * 100}
                  onChange={(e) =>
                    setOverlayOpacity(Number(e.target.value) / 100)
                  }
                  className="w-32"
                />
                <span className="text-xs text-slate-300">
                  {Math.round(overlayOpacity * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {comparisonMode === 'slider' && (
          <div
            ref={sliderRef}
            className="relative h-full cursor-ew-resize overflow-hidden"
            onMouseMove={(e) => {
              if (e.buttons !== 1 || !sliderRef.current) return;
              const rect = sliderRef.current.getBoundingClientRect();
              const pct = ((e.clientX - rect.left) / rect.width) * 100;
              setSliderPos(Math.max(0, Math.min(100, pct)));
            }}
          >
            {/* Full image B (background) */}
            <CompareImage
              item={item2}
              scale={scale}
              offset={offset}
              label="B"
            />
            {/* Clipped image A */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${sliderPos}%` }}
            >
              <div style={{ width: sliderRef.current?.offsetWidth ?? '100%' }}>
                <CompareImage
                  item={item1}
                  scale={scale}
                  offset={offset}
                  label="A"
                />
              </div>
            </div>
            {/* Slider line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/80"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-1.5 shadow">
                <svg className="h-4 w-4 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2 text-xs text-slate-400">
        <span className="truncate">
          A: {item1.fileName}
          {item1.result?.predictions[0] &&
            ` (${item1.result.predictions[0].diseaseLabel.replace(/_/g, ' ')})`}
        </span>
        <span className="truncate text-right">
          B: {item2.fileName}
          {item2.result?.predictions[0] &&
            ` (${item2.result.predictions[0].diseaseLabel.replace(/_/g, ' ')})`}
        </span>
      </div>
    </div>
  );
}

function CompareImage({
  item,
  scale,
  offset,
  label,
}: {
  item: { thumbnail?: string; fileName: string };
  scale: number;
  offset: { x: number; y: number };
  label: string;
}) {
  return (
    <div className="relative flex-1 overflow-hidden rounded-lg bg-slate-900">
      {item.thumbnail ? (
        <img
          src={item.thumbnail}
          alt={item.fileName}
          className="h-full w-full object-contain"
          style={{
            transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
            transformOrigin: 'center',
          }}
          draggable={false}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-slate-700">
          No preview
        </div>
      )}
      <span className="absolute left-2 top-2 rounded bg-slate-900/70 px-2 py-0.5 text-xs font-bold text-slate-300">
        {label}
      </span>
    </div>
  );
}
