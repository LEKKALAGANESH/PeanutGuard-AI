// Disease types
export interface Disease {
  id: number;
  label: string;
  name: Record<string, string>; // locale -> translated name
  scientific_name: string;
  category: 'fungal' | 'viral' | 'bacterial' | 'nematode' | 'nutritional' | 'abiotic';
  severity_descriptions: Record<string, Record<string, string>>; // "1"-"5" -> locale -> description
  treatments: {
    organic: Treatment[];
    chemical: Treatment[];
    cultural: Record<string, string>[]; // locale -> instruction
  };
  yield_impact: { min_pct: number; max_pct: number };
  confusion_pairs: string[];
  climate_triggers: {
    temp_min: number;
    temp_max: number;
    humidity_min: number;
    rainfall_weekly_mm: number;
    growth_stage_days: [number, number];
  };
}

export interface Treatment {
  name: Record<string, string>;
  active_ingredient?: string;
  dosage: string;
  frequency: string;
  brands_by_region: Record<string, string[]>;
  banned_in?: string[];
}

export interface DiseaseLibrary {
  version: string;
  last_updated: string;
  diseases: Disease[];
}

// Scan types
export interface ScanResult {
  id: string;
  timestamp: number;
  imageDataUrl: string; // base64 thumbnail
  predictions: Prediction[];
  lesions: LesionDetection[];
  severityScore: number;
  modelUsed: 'mobilenetv3_large' | 'mobilenetv3_small';
  fieldId?: string;
}

export interface Prediction {
  diseaseLabel: string;
  confidence: number;
}

export interface LesionDetection {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

// Quality types
export interface QualityReport {
  passed: boolean;
  blurScore: number;
  brightness: number;
  issues: ImageIssue[];
  suggestions: string[];
}

export type ImageIssue = 'blur' | 'dark' | 'overexposed' | 'not_peanut' | 'partial_leaf' | 'low_confidence';

// Field types
export interface Field {
  id: string;
  name: string;
  gpsLat?: number;
  gpsLng?: number;
  areaHectares?: number;
  plantingDate?: string;
  variety?: string;
  createdAt: number;
}

// Harvest types
export interface HarvestEntry {
  id: string;
  fieldId: string;
  scanId: string;
  healthScore: number;
  diseasePressureIndex: number;
  estimatedDaysToHarvest: number;
  readinessScore: number;
  notes?: string;
  recordedAt: number;
}

// Model status
export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error' | 'not-downloaded';

export interface ModelInfo {
  name: string;
  status: ModelStatus;
  sizeBytes: number;
  loadTimeMs?: number;
}

// Voice query
export interface VoiceQueryResult {
  transcript: string;
  matchedAction: 'show_treatment' | 'show_severity' | 'show_harvest' | 'show_explanation' | 'show_impact' | 'show_common_questions';
  confidence: number;
}

// User preferences
export interface UserPreferences {
  language: string;
  region: string;
  theme: 'light' | 'dark' | 'system';
}

// Desktop Premium types
export type * from './desktop';
