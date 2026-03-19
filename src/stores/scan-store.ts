import { create } from 'zustand';
import type { ScanResult, QualityReport, ModelInfo } from '@/types';

interface ScanState {
  // Current scan
  currentResult: ScanResult | null;
  isScanning: boolean;
  scanPhase:
    | 'idle'
    | 'capturing'
    | 'preprocessing'
    | 'gate'
    | 'classifying'
    | 'detecting'
    | 'complete'
    | 'error';
  qualityReport: QualityReport | null;
  error: string | null;
  isDemo: boolean;

  // Model status
  models: Record<string, ModelInfo>;

  // Actions
  setCurrentResult: (result: ScanResult | null) => void;
  setScanPhase: (phase: ScanState['scanPhase']) => void;
  setQualityReport: (report: QualityReport | null) => void;
  setError: (error: string | null) => void;
  setIsDemo: (isDemo: boolean) => void;
  setModelStatus: (name: string, info: Partial<ModelInfo>) => void;
  resetScan: () => void;
}

const initialState: Pick<
  ScanState,
  'currentResult' | 'isScanning' | 'scanPhase' | 'qualityReport' | 'error' | 'isDemo' | 'models'
> = {
  currentResult: null,
  isScanning: false,
  scanPhase: 'idle',
  qualityReport: null,
  error: null,
  isDemo: false,
  models: {},
};

export const useScanStore = create<ScanState>((set) => ({
  ...initialState,

  setCurrentResult: (result) =>
    set({
      currentResult: result,
      isScanning: result !== null,
      scanPhase: result !== null ? 'complete' : 'idle',
    }),

  setScanPhase: (phase) =>
    set((state) => ({
      scanPhase: phase,
      isScanning: phase !== 'idle' && phase !== 'complete' && phase !== 'error',
      // Keep existing error when entering error phase; clear when leaving
      error: phase === 'error' ? state.error : null,
    })),

  setQualityReport: (report) => set({ qualityReport: report }),

  setError: (error) =>
    set({
      error,
      scanPhase: error !== null ? 'error' : 'idle',
      isScanning: false,
    }),

  setIsDemo: (isDemo) => set({ isDemo }),

  setModelStatus: (name, info) =>
    set((state) => ({
      models: {
        ...state.models,
        [name]: {
          ...{ name, status: 'idle' as const, sizeBytes: 0 },
          ...state.models[name],
          ...info,
          name, // ensure name is always correct
        },
      },
    })),

  resetScan: () => set(initialState),
}));
