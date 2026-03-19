import { db, type HarvestRecord } from './index';
import type { HarvestEntry } from '@/types';

/** Convert an application-level HarvestEntry to a DB HarvestRecord. */
function toRecord(entry: HarvestEntry): HarvestRecord {
  return {
    id: entry.id,
    fieldId: entry.fieldId,
    scanId: entry.scanId,
    healthScore: entry.healthScore,
    diseasePressureIndex: entry.diseasePressureIndex,
    estimatedDaysToHarvest: entry.estimatedDaysToHarvest,
    readinessScore: entry.readinessScore,
    notes: entry.notes,
    recordedAt: entry.recordedAt,
  };
}

/**
 * Calculate disease pressure index from recent scan severities.
 * Returns 0-1 where 1 = maximum disease pressure.
 */
export function calculateDiseasePressure(severityScores: number[]): number {
  if (severityScores.length === 0) return 0;
  const avgSeverity = severityScores.reduce((a, b) => a + b, 0) / severityScores.length;
  return Math.min(1, avgSeverity / 5);
}

/**
 * Calculate harvest readiness score (0-100%) based on:
 * - Days since planting vs maturity period
 * - Disease pressure (high pressure = harvest sooner)
 * - Health score trend
 */
export function calculateReadinessScore(
  daysSincePlanting: number,
  maturityDays: number,
  diseasePressure: number,
  healthScore: number,
): number {
  // Base readiness from days (0-70% contribution)
  const daysFraction = Math.min(1, daysSincePlanting / maturityDays);
  const baseReadiness = daysFraction * 70;

  // Disease pressure accelerates harvest (0-20% contribution)
  // High pressure + late stage = harvest sooner
  const pressureBonus = diseasePressure > 0.5 && daysFraction > 0.7
    ? (diseasePressure - 0.5) * 2 * 20
    : 0;

  // Health penalty (0-10% deduction)
  // Very low health near maturity suggests urgent harvest
  const healthPenalty = healthScore < 50 && daysFraction > 0.6
    ? 10
    : 0;

  return Math.min(100, Math.max(0, Math.round(
    baseReadiness + pressureBonus + healthPenalty
  )));
}

export const harvestRepository = {
  /** Save a harvest assessment. */
  async save(entry: HarvestEntry): Promise<void> {
    await db.harvest.add(toRecord(entry));
  },

  /** Get all harvest records for a field, newest first. */
  async getByField(fieldId: string): Promise<HarvestRecord[]> {
    const records = await db.harvest
      .where('fieldId')
      .equals(fieldId)
      .toArray();
    return records.sort((a, b) => b.recordedAt - a.recordedAt);
  },

  /** Get the latest harvest record for a field. */
  async getLatest(fieldId: string): Promise<HarvestRecord | undefined> {
    const records = await this.getByField(fieldId);
    return records[0];
  },

  /** Get a single record by ID. */
  async getById(id: string): Promise<HarvestRecord | undefined> {
    return db.harvest.get(id);
  },

  /** Delete a harvest record. */
  async delete(id: string): Promise<void> {
    await db.harvest.delete(id);
  },

  /** Get all records for a specific scan. */
  async getByScan(scanId: string): Promise<HarvestRecord[]> {
    return db.harvest
      .where('scanId')
      .equals(scanId)
      .toArray();
  },

  /** Count total harvest assessments. */
  async count(): Promise<number> {
    return db.harvest.count();
  },

  /**
   * Build a harvest timeline for a field — health scores over time.
   * Returns records sorted chronologically for chart display.
   */
  async getTimeline(fieldId: string): Promise<{
    dates: number[];
    healthScores: number[];
    readinessScores: number[];
    diseasePressure: number[];
  }> {
    const records = await db.harvest
      .where('fieldId')
      .equals(fieldId)
      .toArray();
    records.sort((a, b) => a.recordedAt - b.recordedAt);

    return {
      dates: records.map(r => r.recordedAt),
      healthScores: records.map(r => r.healthScore),
      readinessScores: records.map(r => r.readinessScore),
      diseasePressure: records.map(r => r.diseasePressureIndex),
    };
  },
};
