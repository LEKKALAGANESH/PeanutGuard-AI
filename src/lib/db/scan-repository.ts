import { db, type ScanRecord } from './index';
import type { ScanResult } from '@/types';

/** Convert an application-level ScanResult to a DB ScanRecord. */
function toRecord(result: ScanResult): ScanRecord {
  return {
    id: result.id,
    fieldId: result.fieldId,
    timestamp: result.timestamp,
    imageDataUrl: result.imageDataUrl,
    predictions: result.predictions.map((p) => ({
      diseaseLabel: p.diseaseLabel,
      confidence: p.confidence,
    })),
    lesions: result.lesions.map((l) => ({
      x: l.x,
      y: l.y,
      width: l.width,
      height: l.height,
      confidence: l.confidence,
    })),
    severityScore: result.severityScore,
    modelUsed: result.modelUsed,
    synced: false,
  };
}

export const scanRepository = {
  /** Save a scan result to IndexedDB. */
  async save(result: ScanResult): Promise<void> {
    await db.scans.add(toRecord(result));
  },

  /** Get all scans, newest first. */
  async getAll(): Promise<ScanRecord[]> {
    return db.scans.orderBy('timestamp').reverse().toArray();
  },

  /** Get scans for a specific field, newest first. */
  async getByField(fieldId: string): Promise<ScanRecord[]> {
    const records = await db.scans
      .where('fieldId')
      .equals(fieldId)
      .toArray();
    return records.sort((a, b) => b.timestamp - a.timestamp);
  },

  /** Get a single scan by ID. */
  async getById(id: string): Promise<ScanRecord | undefined> {
    return db.scans.get(id);
  },

  /** Delete a scan. */
  async delete(id: string): Promise<void> {
    await db.scans.delete(id);
  },

  /** Get unsynced scans (for background cloud sync). */
  async getUnsynced(): Promise<ScanRecord[]> {
    return db.scans.filter((scan) => !scan.synced).toArray();
  },

  /** Mark a scan as synced after successful cloud upload. */
  async markSynced(id: string): Promise<void> {
    await db.scans.update(id, { synced: true });
  },

  /** Get total scan count. */
  async count(): Promise<number> {
    return db.scans.count();
  },

  /** Get the most recent N scans. */
  async getRecent(limit: number): Promise<ScanRecord[]> {
    return db.scans.orderBy('timestamp').reverse().limit(limit).toArray();
  },
};
