'use client';

import { useEffect, useState, useCallback } from 'react';
import { fieldRepository } from '@/lib/db/field-repository';
import type { FieldRecord } from '@/lib/db';

export default function FieldsPage() {
  const [fields, setFields] = useState<FieldRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newField, setNewField] = useState({
    name: '',
    plantingDate: '',
    variety: '',
  });

  const loadFields = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await fieldRepository.getAll();
      setFields(records);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Failed to load fields: ${err.message}`
          : 'Failed to load fields'
      );
      setFields([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  async function handleAddField() {
    if (!newField.name.trim()) return;

    try {
      await fieldRepository.save({
        id: crypto.randomUUID(),
        name: newField.name.trim(),
        plantingDate: newField.plantingDate || undefined,
        variety: newField.variety.trim() || undefined,
        createdAt: Date.now(),
      });
      setNewField({ name: '', plantingDate: '', variety: '' });
      setShowAddForm(false);
      await loadFields();
    } catch (err) {
      setError(
        err instanceof Error
          ? `Failed to save field: ${err.message}`
          : 'Failed to save field'
      );
    }
  }

  async function handleDeleteField(id: string) {
    try {
      await fieldRepository.delete(id);
      await loadFields();
    } catch (err) {
      setError(
        err instanceof Error
          ? `Failed to delete field: ${err.message}`
          : 'Failed to delete field'
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold">My Fields</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex h-10 items-center gap-1.5 rounded-full bg-green-600 px-4 text-sm font-medium text-white transition-colors active:bg-green-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Field
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Add Field Form */}
      {showAddForm && (
        <div className="flex flex-col gap-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
          <input
            type="text"
            placeholder="Field name"
            value={newField.name}
            onChange={(e) => setNewField((prev) => ({ ...prev, name: e.target.value }))}
            className="h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
          />
          <input
            type="date"
            placeholder="Planting date"
            value={newField.plantingDate}
            onChange={(e) => setNewField((prev) => ({ ...prev, plantingDate: e.target.value }))}
            className="h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
          />
          <input
            type="text"
            placeholder="Variety (e.g., Valencia, Runner)"
            value={newField.variety}
            onChange={(e) => setNewField((prev) => ({ ...prev, variety: e.target.value }))}
            className="h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddForm(false)}
              className="flex h-10 flex-1 items-center justify-center rounded-lg border border-[var(--color-border)] text-sm font-medium transition-colors active:bg-[var(--color-muted)]"
            >
              Cancel
            </button>
            <button
              onClick={handleAddField}
              disabled={!newField.name.trim()}
              className="flex h-10 flex-1 items-center justify-center rounded-lg bg-green-600 text-sm font-medium text-white transition-colors active:bg-green-700 disabled:opacity-40"
            >
              Save Field
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
        </div>
      ) : fields.length === 0 && !showAddForm ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="text-5xl">🗺️</span>
          <div>
            <p className="text-base font-medium">No fields yet</p>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Add your peanut fields to track crop health over time
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-2 rounded-full bg-green-600 px-6 py-2.5 text-sm font-medium text-white transition-colors active:bg-green-700"
          >
            Add Your First Field
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {fields.map((field) => (
            <li
              key={field.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] p-4"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-xl dark:bg-green-900">
                🌾
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-semibold">{field.name}</p>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  {field.plantingDate && (
                    <span>
                      Planted{' '}
                      {new Date(field.plantingDate).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                  {field.variety && <span>{field.variety}</span>}
                </div>
              </div>
              <button
                onClick={() => handleDeleteField(field.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900"
                aria-label="Delete field"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
