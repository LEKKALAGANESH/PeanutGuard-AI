import { db, type FieldRecord } from './index';
import type { Field } from '@/types';

/** Convert an application-level Field to a DB FieldRecord. */
function toRecord(field: Field): FieldRecord {
  return {
    id: field.id,
    name: field.name,
    gpsLat: field.gpsLat,
    gpsLng: field.gpsLng,
    areaHectares: field.areaHectares,
    plantingDate: field.plantingDate,
    variety: field.variety,
    createdAt: field.createdAt,
  };
}

export const fieldRepository = {
  /** Save a new field to IndexedDB. */
  async save(field: Field): Promise<void> {
    await db.fields.add(toRecord(field));
  },

  /** Get all fields, newest first. */
  async getAll(): Promise<FieldRecord[]> {
    return db.fields.orderBy('createdAt').reverse().toArray();
  },

  /** Get a single field by ID. */
  async getById(id: string): Promise<FieldRecord | undefined> {
    return db.fields.get(id);
  },

  /** Update specific properties of a field. */
  async update(id: string, updates: Partial<FieldRecord>): Promise<void> {
    await db.fields.update(id, updates);
  },

  /** Delete a field by ID. */
  async delete(id: string): Promise<void> {
    await db.fields.delete(id);
  },
};
