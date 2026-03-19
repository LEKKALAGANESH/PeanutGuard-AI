import { create } from 'zustand';
import type { BulkScanItem, BulkScanStatus, BulkScanResult, BatchStats } from '@/types/desktop';
import { getBatchSummary } from '@/lib/db/batch-repository';

interface BulkScanState {
  items: BulkScanItem[];
  batchId: string | null;
  isProcessing: boolean;
  isPaused: boolean;
  stats: BatchStats;

  // Actions
  addFiles: (files: File[]) => void;
  updateItem: (id: string, partial: Partial<BulkScanItem>) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
  startBatch: () => void;
  pauseBatch: () => void;
  resumeBatch: () => void;
  recalculateStats: () => void;
}

const emptyStats: BatchStats = {
  total: 0,
  completed: 0,
  healthy: 0,
  diseased: 0,
  failed: 0,
  skipped: 0,
  avgConfidence: 0,
  avgInferenceMs: 0,
  diseaseDistribution: {},
};

export const useBulkScanStore = create<BulkScanState>((set, get) => ({
  items: [],
  batchId: null,
  isProcessing: false,
  isPaused: false,
  stats: { ...emptyStats },

  addFiles: (files) => {
    const currentItems = get().items;
    const startPos = currentItems.length;

    const newItems: BulkScanItem[] = files.map((file, index) => ({
      id: crypto.randomUUID(),
      file,
      fileName: file.name,
      status: 'queued' as BulkScanStatus,
      queuePosition: startPos + index,
    }));

    set((state) => ({
      items: [...state.items, ...newItems],
      batchId: state.batchId ?? crypto.randomUUID(),
    }));
    get().recalculateStats();

    // Generate thumbnails asynchronously — deferred to avoid
    // "state update on unmounted component" during render
    queueMicrotask(() => {
      for (const item of newItems) {
        createThumbnail(item.file)
          .then((thumbnail) => {
            get().updateItem(item.id, { thumbnail });
          })
          .catch(() => {
            // Thumbnail generation is non-critical
          });
      }
    });
  },

  updateItem: (id, partial) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...partial } : item,
      ),
    }));
  },

  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));
    get().recalculateStats();
  },

  clearAll: () => {
    set({
      items: [],
      batchId: null,
      isProcessing: false,
      isPaused: false,
      stats: { ...emptyStats },
    });
  },

  startBatch: () => {
    set({ isProcessing: true, isPaused: false });
  },

  pauseBatch: () => {
    set({ isPaused: true });
  },

  resumeBatch: () => {
    set({ isPaused: false });
  },

  recalculateStats: () => {
    const items = get().items;
    set({ stats: getBatchSummary(items) });
  },
}));

/**
 * Create a small JPEG thumbnail from a File for display.
 */
async function createThumbnail(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 120;
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(size, size)
      : document.createElement('canvas');

  if (canvas instanceof HTMLCanvasElement) {
    canvas.width = size;
    canvas.height = size;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Failed to get canvas 2D context for thumbnail');
  }
  (ctx as CanvasRenderingContext2D).drawImage(bitmap, 0, 0, size, size);
  bitmap.close();

  if (canvas instanceof OffscreenCanvas) {
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.6 });
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('Not a string'));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  return (canvas as HTMLCanvasElement).toDataURL('image/jpeg', 0.6);
}
