import Dexie, { type EntityTable } from 'dexie';

/** IndexedDB record for a completed scan. */
interface ScanRecord {
  id: string;
  fieldId?: string;
  timestamp: number;
  imageDataUrl: string;
  predictions: Array<{ diseaseLabel: string; confidence: number }>;
  lesions: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }>;
  severityScore: number;
  modelUsed: string;
  /** false until metadata has been uploaded to Supabase */
  synced: boolean;
}

/** IndexedDB record for a farmer's field. */
interface FieldRecord {
  id: string;
  name: string;
  gpsLat?: number;
  gpsLng?: number;
  areaHectares?: number;
  plantingDate?: string;
  variety?: string;
  createdAt: number;
}

/** IndexedDB record for a harvest readiness assessment. */
interface HarvestRecord {
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

/** IndexedDB record for offline sync queue actions. */
interface SyncQueueRecord {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'failed';
  retries: number;
  createdAt: number;
}

const db = new Dexie('PeanutGuardDB') as Dexie & {
  scans: EntityTable<ScanRecord, 'id'>;
  fields: EntityTable<FieldRecord, 'id'>;
  harvest: EntityTable<HarvestRecord, 'id'>;
  syncQueue: EntityTable<SyncQueueRecord, 'id'>;
};

db.version(1).stores({
  scans: 'id, fieldId, timestamp, synced',
  fields: 'id, name, createdAt',
  harvest: 'id, fieldId, scanId, recordedAt',
});

db.version(2).stores({
  scans: 'id, fieldId, timestamp, synced',
  fields: 'id, name, createdAt',
  harvest: 'id, fieldId, scanId, recordedAt',
  syncQueue: 'id, action, status, createdAt',
});

export { db };
export type { ScanRecord, FieldRecord, HarvestRecord, SyncQueueRecord };
