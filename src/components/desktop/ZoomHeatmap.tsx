'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useDesktopUIStore } from '@/stores/desktop-ui-store';
import { useBulkScanStore } from '@/stores/bulk-scan-store';
import { useHeatmap } from '@/hooks/useHeatmap';
import { useImageZoom } from '@/hooks/useImageZoom';

export function ZoomHeatmap() {
  const zoomTargetId = useDesktopUIStore((s) => s.zoomTargetId);
  const closeInspector = useDesktopUIStore((s) => s.toggleInspector);
  const items = useBulkScanStore((s) => s.items);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const {
    showHeatmap,
    showBoxes,
    opacity,
    setOpacity,
    toggleHeatmap,
    toggleBoxes,
    drawOverlay,
  } = useHeatmap();

  const { scale, offset, handlers, resetZoom, setScale } = useImageZoom();

  const item = zoomTargetId
    ? items.find((i) => i.id === zoomTargetId)
    : null;

  const redraw = useCallback(() => {
    if (!canvasRef.current || !imageRef.current || !item) return;
    drawOverlay(
      canvasRef.current,
      imageRef.current,
      item.result?.lesions ?? [],
      showHeatmap,
      showBoxes,
      opacity,
    );
  }, [item, drawOverlay, showHeatmap, showBoxes, opacity]);

  // Load image and draw
  useEffect(() => {
    if (!item?.thumbnail) return;

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      redraw();
    };
    img.src = item.thumbnail;
  }, [item?.thumbnail, redraw]);

  // Redraw on toggle changes
  useEffect(() => {
    redraw();
  }, [redraw, showHeatmap, showBoxes, opacity]);

  if (!item) return null;

  const topPred = item.result?.predictions[0];
  const lesionCount = item.result?.lesions?.length ?? 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h3 className="truncate text-sm font-medium text-slate-200">
          {item.fileName}
        </h3>
        <button
          onClick={closeInspector}
          className="rounded-md p-1 text-slate-500 transition-colors hover:text-slate-200"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Canvas area */}
      <div
        className="relative flex-1 overflow-hidden bg-slate-950"
        {...handlers}
      >
        <canvas
          ref={canvasRef}
          className="h-full w-full object-contain"
          style={{
            transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
            transformOrigin: 'center',
          }}
        />
      </div>

      {/* Controls */}
      <div className="border-t border-slate-800 px-4 py-3">
        <div className="mb-3 flex items-center gap-2">
          <ToggleButton
            label="Boxes"
            active={showBoxes}
            onClick={toggleBoxes}
            shortcut="B"
          />
          <ToggleButton
            label="Heatmap"
            active={showHeatmap}
            onClick={toggleHeatmap}
            shortcut="H"
          />
          <button
            onClick={resetZoom}
            className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-400 transition-colors hover:text-slate-200"
          >
            Reset Zoom
          </button>
        </div>

        {showHeatmap && (
          <div className="mb-3 flex items-center gap-3">
            <span className="text-xs text-slate-500">Opacity</span>
            <input
              type="range"
              min={0}
              max={100}
              value={opacity * 100}
              onChange={(e) => setOpacity(Number(e.target.value) / 100)}
              className="flex-1"
            />
            <span className="text-xs text-slate-400">
              {Math.round(opacity * 100)}%
            </span>
          </div>
        )}

        <div className="mb-3 flex items-center gap-3">
          <span className="text-xs text-slate-500">Zoom</span>
          <input
            type="range"
            min={100}
            max={800}
            value={scale * 100}
            onChange={(e) => setScale(Number(e.target.value) / 100)}
            className="flex-1"
          />
          <span className="text-xs text-slate-400">
            {Math.round(scale * 100)}%
          </span>
        </div>

        {/* Disease info */}
        {item.result && (
          <div className="border-t border-slate-800 pt-3">
            {topPred && (
              <div className="mb-2">
                <p className="text-sm font-medium text-slate-200">
                  {topPred.diseaseLabel.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-slate-400">
                  {Math.round(topPred.confidence * 100)}% confidence
                </p>
              </div>
            )}

            {/* All predictions */}
            {item.result.predictions.length > 1 && (
              <div className="mb-2">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-600">
                  Predictions
                </p>
                {item.result.predictions.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-0.5"
                  >
                    <span className="text-xs text-slate-400">
                      {p.diseaseLabel.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-slate-500">
                      {Math.round(p.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Severity meter */}
            {item.result.severityScore > 0 && (
              <div className="mb-2">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-600">
                  Severity
                </p>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 flex-1 rounded-full ${
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
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Level {item.result.severityScore}/5
                </p>
              </div>
            )}

            <p className="text-[10px] text-slate-600">
              {lesionCount} lesion{lesionCount !== 1 ? 's' : ''} detected
              {item.result.inferenceMs > 0 &&
                ` | ${Math.round(item.result.inferenceMs)}ms`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleButton({
  label,
  active,
  onClick,
  shortcut,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  shortcut?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-green-900/50 text-green-300'
          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
      }`}
    >
      {label}
      {shortcut && (
        <span className="ml-1 text-[9px] text-slate-600">({shortcut})</span>
      )}
    </button>
  );
}
