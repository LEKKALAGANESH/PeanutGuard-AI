'use client';

import { useCallback, useRef, useMemo, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useBulkScanStore } from '@/stores/bulk-scan-store';
import { useDesktopUIStore } from '@/stores/desktop-ui-store';
import { ImageCard } from './ImageCard';
import { ContextMenu } from './ContextMenu';
import type { BulkScanItem } from '@/types/desktop';

export function BulkImageGrid() {
  const items = useBulkScanStore((s) => s.items);
  const filters = useDesktopUIStore((s) => s.filters);
  const sort = useDesktopUIStore((s) => s.sort);
  const selectedIds = useDesktopUIStore((s) => s.selectedIds);
  const toggleSelect = useDesktopUIStore((s) => s.toggleSelect);
  const selectRange = useDesktopUIStore((s) => s.selectRange);
  const openContextMenu = useDesktopUIStore((s) => s.openContextMenu);
  const lastClickedIdx = useRef<number>(-1);

  // Filter
  const filtered = useMemo(() => {
    let result = [...items];

    if (filters.disease) {
      result = result.filter(
        (i) => i.result?.predictions[0]?.diseaseLabel === filters.disease,
      );
    }
    if (filters.status) {
      result = result.filter((i) => i.status === filters.status);
    }
    if (filters.minConfidence != null) {
      result = result.filter(
        (i) =>
          (i.result?.predictions[0]?.confidence ?? 0) >= filters.minConfidence!,
      );
    }
    if (filters.severity != null) {
      result = result.filter(
        (i) => (i.result?.severityScore ?? 0) >= filters.severity!,
      );
    }

    return result;
  }, [items, filters]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sort.direction === 'asc' ? 1 : -1;

    arr.sort((a, b) => {
      switch (sort.sortBy) {
        case 'name':
          return dir * a.fileName.localeCompare(b.fileName);
        case 'confidence': {
          const ca = a.result?.predictions[0]?.confidence ?? 0;
          const cb = b.result?.predictions[0]?.confidence ?? 0;
          return dir * (ca - cb);
        }
        case 'severity': {
          const sa = a.result?.severityScore ?? 0;
          const sb = b.result?.severityScore ?? 0;
          return dir * (sa - sb);
        }
        case 'time':
        default:
          return dir * (a.queuePosition - b.queuePosition);
      }
    });

    return arr;
  }, [filtered, sort]);

  // Virtualization: IntersectionObserver
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const shouldVirtualize = sorted.length > 200;

  useEffect(() => {
    if (!shouldVirtualize) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        setVisibleIds((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const id = entry.target.getAttribute('data-item-id');
            if (!id) continue;
            if (entry.isIntersecting) {
              next.add(id);
            } else {
              next.delete(id);
            }
          }
          return next;
        });
      },
      { rootMargin: '200px' },
    );

    return () => observerRef.current?.disconnect();
  }, [shouldVirtualize]);

  const itemRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el || !shouldVirtualize || !observerRef.current) return;
      observerRef.current.observe(el);
    },
    [shouldVirtualize],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent, item: BulkScanItem, index: number) => {
      if (e.shiftKey && lastClickedIdx.current >= 0) {
        const allIds = sorted.map((i) => i.id);
        selectRange(lastClickedIdx.current, index, allIds);
      } else if (e.ctrlKey || e.metaKey) {
        toggleSelect(item.id);
      } else {
        toggleSelect(item.id);
      }
      lastClickedIdx.current = index;
    },
    [sorted, selectRange, toggleSelect],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, item: BulkScanItem) => {
      openContextMenu(e.clientX, e.clientY, item.id);
    },
    [openContextMenu],
  );

  return (
    <div className="desktop-scrollbar relative flex-1 overflow-y-auto p-4">
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        }}
      >
        <AnimatePresence mode="popLayout">
          {sorted.map((item, index) => {
            const isVisible =
              !shouldVirtualize || visibleIds.has(item.id);

            return (
              <motion.div
                key={item.id}
                ref={itemRef}
                data-item-id={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                {isVisible ? (
                  <ImageCard
                    item={item}
                    isSelected={selectedIds.includes(item.id)}
                    onClick={(e) => handleClick(e, item, index)}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                  />
                ) : (
                  // Placeholder for virtualized items
                  <div className="glass-card aspect-square rounded-xl" />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <ContextMenu />
    </div>
  );
}
