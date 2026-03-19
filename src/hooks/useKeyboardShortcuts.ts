'use client';

import { useEffect } from 'react';

interface ShortcutHandlers {
  onToggleBatch?: () => void;
  onDeleteSelected?: () => void;
  onDeselectAll?: () => void;
  onToggleHeatmap?: () => void;
  onToggleBoxes?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  onFilterSeverity?: (level: number) => void;
  onOpenFiles?: () => void;
  onOpenFolder?: () => void;
  onExportSelected?: () => void;
  onExportAll?: () => void;
  onFullscreen?: () => void;
  onSettings?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          handlers.onToggleBatch?.();
          break;
        case 'Delete':
        case 'Backspace':
          handlers.onDeleteSelected?.();
          break;
        case 'Escape':
          handlers.onDeselectAll?.();
          break;
        case 'KeyH':
          handlers.onToggleHeatmap?.();
          break;
        case 'KeyB':
          handlers.onToggleBoxes?.();
          break;
        case 'Equal':
        case 'NumpadAdd':
          handlers.onZoomIn?.();
          break;
        case 'Minus':
        case 'NumpadSubtract':
          handlers.onZoomOut?.();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          handlers.onNavigatePrev?.();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          handlers.onNavigateNext?.();
          break;
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
        case 'Digit4':
        case 'Digit5':
          handlers.onFilterSeverity?.(parseInt(e.code.replace('Digit', '')));
          break;
        case 'KeyO':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) {
              handlers.onOpenFolder?.();
            } else {
              handlers.onOpenFiles?.();
            }
          }
          break;
        case 'KeyE':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) {
              handlers.onExportAll?.();
            } else {
              handlers.onExportSelected?.();
            }
          }
          break;
        case 'KeyF':
          if (!e.ctrlKey && !e.metaKey) {
            handlers.onFullscreen?.();
          }
          break;
        case 'Comma':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handlers.onSettings?.();
          }
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}
