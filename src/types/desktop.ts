import type { Prediction, LesionDetection } from './index';

// ---------------------------------------------------------------------------
// Bulk scan pipeline
// ---------------------------------------------------------------------------

export type BulkScanStatus =
  | 'queued'
  | 'preprocessing'
  | 'gate'
  | 'classifying'
  | 'detecting'
  | 'complete'
  | 'error'
  | 'skipped';

export interface BulkScanItem {
  id: string;
  file: File;
  fileName: string;
  status: BulkScanStatus;
  result?: BulkScanResult;
  thumbnail?: string;
  error?: string;
  startTime?: number;
  endTime?: number;
  queuePosition: number;
}

export interface BulkScanResult {
  isPeanut: boolean;
  peanutConfidence: number;
  predictions: Prediction[];
  lesions: LesionDetection[];
  severityScore: number;
  modelUsed: 'mobilenetv3_large' | 'mobilenetv3_small';
  inferenceMs: number;
  environmentalRisks?: EnvironmentalRisk[];
}

// ---------------------------------------------------------------------------
// Worker communication
// ---------------------------------------------------------------------------

export type WorkerCommand =
  | { type: 'init' }
  | { type: 'infer'; id: string; imageBuffer: ArrayBuffer }
  | { type: 'dispose' };

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'progress'; id: string; phase: BulkScanStatus }
  | { type: 'result'; id: string; result: BulkScanResult; thumbnail: string }
  | { type: 'error'; id: string; error: string };

// ---------------------------------------------------------------------------
// Geolocation & weather
// ---------------------------------------------------------------------------

export interface GeoLocation {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export interface WeatherData {
  temperature: number;
  humidity: number;
  precipitation: number;
  soilMoisture: number;
  rainfallWeeklyMm: number;
  fetchedAt: number;
}

// ---------------------------------------------------------------------------
// Environmental risk engine
// ---------------------------------------------------------------------------

export interface EnvironmentalRisk {
  diseaseLabel: string;
  priorProbability: number;
  riskMultiplier: number;
  weatherMatch: number;
  finalRisk: number;
}

// ---------------------------------------------------------------------------
// Batch statistics
// ---------------------------------------------------------------------------

export interface BatchStats {
  total: number;
  completed: number;
  healthy: number;
  diseased: number;
  failed: number;
  skipped: number;
  avgConfidence: number;
  avgInferenceMs: number;
  diseaseDistribution: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Desktop UI state
// ---------------------------------------------------------------------------

export type ComparisonMode = 'side_by_side' | 'overlay' | 'slider';

export interface FilterState {
  disease?: string;
  status?: BulkScanStatus;
  minConfidence?: number;
  severity?: number;
}

export interface SortConfig {
  sortBy: 'name' | 'confidence' | 'severity' | 'time';
  direction: 'asc' | 'desc';
}
