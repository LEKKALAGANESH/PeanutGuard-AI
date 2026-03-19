'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDesktopUIStore } from '@/stores/desktop-ui-store';
import { useBulkScanStore } from '@/stores/bulk-scan-store';

interface ContextMenuProps {
  onRescan?: (id: string) => void;
  onExportSingle?: (id: string) => void;
}

export function ContextMenu({ onRescan, onExportSingle }: ContextMenuProps) {
  const contextMenu = useDesktopUIStore((s) => s.contextMenu);
  const closeContextMenu = useDesktopUIStore((s) => s.closeContextMenu);
  const toggleSelect = useDesktopUIStore((s) => s.toggleSelect);
  const selectedIds = useDesktopUIStore((s) => s.selectedIds);
  const openComparison = useDesktopUIStore((s) => s.openComparison);
  const setZoomTarget = useDesktopUIStore((s) => s.setZoomTarget);
  const removeItem = useBulkScanStore((s) => s.removeItem);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu();
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [contextMenu, closeContextMenu]);

  if (!contextMenu) return null;

  const { x, y, itemId } = contextMenu;

  const menuItems = [
    {
      label: 'View Details',
      action: () => {
        setZoomTarget(itemId);
        closeContextMenu();
      },
    },
    ...(selectedIds.length === 1 && selectedIds[0] !== itemId
      ? [
          {
            label: 'Compare With Selected',
            action: () => {
              openComparison(selectedIds[0], itemId);
              closeContextMenu();
            },
          },
        ]
      : []),
    ...(onRescan
      ? [
          {
            label: 'Re-scan',
            action: () => {
              onRescan(itemId);
              closeContextMenu();
            },
          },
        ]
      : []),
    {
      label: 'Remove',
      action: () => {
        removeItem(itemId);
        closeContextMenu();
      },
      danger: true,
    },
    ...(onExportSingle
      ? [
          {
            label: 'Export PDF',
            action: () => {
              onExportSingle(itemId);
              closeContextMenu();
            },
          },
        ]
      : []),
  ];

  return createPortal(
    <div
      ref={menuRef}
      className="glass-elevated fixed z-50 min-w-[160px] rounded-xl py-1.5"
      style={{
        left: Math.min(x, window.innerWidth - 180),
        top: Math.min(y, window.innerHeight - menuItems.length * 36 - 16),
      }}
    >
      {menuItems.map((item, i) => (
        <button
          key={i}
          onClick={item.action}
          className={`flex w-full items-center px-4 py-2 text-left text-sm transition-colors ${
            'danger' in item && item.danger
              ? 'text-red-400 hover:bg-red-900/30'
              : 'text-slate-300 hover:bg-slate-700/50'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
