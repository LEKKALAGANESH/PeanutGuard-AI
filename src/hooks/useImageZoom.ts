'use client';

import { useCallback, useRef, useState } from 'react';

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const ZOOM_FACTOR = 0.1;

export function useImageZoom() {
  const [scale, setScale] = useState(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      setScale((prev) => {
        const next = prev + (e.deltaY < 0 ? ZOOM_FACTOR : -ZOOM_FACTOR) * prev;
        return Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
      });
    },
    [],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: offsetRef.current.x,
        origY: offsetRef.current.y,
      };
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const newOffset = {
        x: dragRef.current.origX + dx,
        y: dragRef.current.origY + dy,
      };
      offsetRef.current = newOffset;
      setOffset(newOffset);
    },
    [],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    offsetRef.current = { x: 0, y: 0 };
    setOffset({ x: 0, y: 0 });
  }, []);

  return {
    scale,
    offset,
    handlers: { onWheel, onPointerDown, onPointerMove, onPointerUp },
    resetZoom,
    setScale,
  };
}
