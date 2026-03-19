import { create } from 'zustand';
import type { ComparisonMode, FilterState, SortConfig } from '@/types/desktop';

interface DesktopUIState {
  selectedIds: string[];
  comparisonPair: [string, string] | null;
  comparisonMode: ComparisonMode;
  zoomTargetId: string | null;
  sidebarOpen: boolean;
  inspectorOpen: boolean;
  filters: FilterState;
  sort: SortConfig;
  contextMenu: { x: number; y: number; itemId: string } | null;

  // Actions
  toggleSelect: (id: string) => void;
  selectRange: (from: number, to: number, itemIds: string[]) => void;
  selectAll: (itemIds: string[]) => void;
  deselectAll: () => void;
  setZoomTarget: (id: string | null) => void;
  openComparison: (id1: string, id2: string) => void;
  closeComparison: () => void;
  setComparisonMode: (mode: ComparisonMode) => void;
  toggleSidebar: () => void;
  toggleInspector: () => void;
  setFilters: (filters: Partial<FilterState>) => void;
  setSort: (sort: Partial<SortConfig>) => void;
  openContextMenu: (x: number, y: number, itemId: string) => void;
  closeContextMenu: () => void;
}

export const useDesktopUIStore = create<DesktopUIState>((set) => ({
  selectedIds: [],
  comparisonPair: null,
  comparisonMode: 'side_by_side',
  zoomTargetId: null,
  sidebarOpen: true,
  inspectorOpen: false,
  filters: {},
  sort: { sortBy: 'time', direction: 'desc' },
  contextMenu: null,

  toggleSelect: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((s) => s !== id)
        : [...state.selectedIds, id],
      zoomTargetId: state.selectedIds.includes(id) ? null : id,
      inspectorOpen: !state.selectedIds.includes(id),
    })),

  selectRange: (from, to, itemIds) =>
    set(() => {
      const start = Math.min(from, to);
      const end = Math.max(from, to);
      return { selectedIds: itemIds.slice(start, end + 1) };
    }),

  selectAll: (itemIds) => set({ selectedIds: [...itemIds] }),

  deselectAll: () =>
    set({ selectedIds: [], zoomTargetId: null, inspectorOpen: false }),

  setZoomTarget: (id) =>
    set({ zoomTargetId: id, inspectorOpen: id !== null }),

  openComparison: (id1, id2) =>
    set({ comparisonPair: [id1, id2], inspectorOpen: true }),

  closeComparison: () =>
    set({ comparisonPair: null }),

  setComparisonMode: (mode) =>
    set({ comparisonMode: mode }),

  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  toggleInspector: () =>
    set((state) => ({ inspectorOpen: !state.inspectorOpen })),

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),

  setSort: (sort) =>
    set((state) => ({ sort: { ...state.sort, ...sort } })),

  openContextMenu: (x, y, itemId) =>
    set({ contextMenu: { x, y, itemId } }),

  closeContextMenu: () =>
    set({ contextMenu: null }),
}));
