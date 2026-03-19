"use client";

import { useState, useEffect, useCallback } from 'react';
import { scanRepository } from '@/lib/db/scan-repository';
import type { ScanRecord } from '@/lib/db';

interface UseHistoryReturn {
  scans: ScanRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  deleteScan: (id: string) => Promise<void>;
  totalCount: number;
}

export function useHistory(limit?: number): UseHistoryReturn {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [records, count] = await Promise.all([
        limit ? scanRepository.getRecent(limit) : scanRepository.getAll(),
        scanRepository.count(),
      ]);
      setScans(records);
      setTotalCount(count);
    } catch (err) {
      setScans([]);
      setTotalCount(0);
      setError(
        err instanceof Error
          ? `Failed to load scan history: ${err.message}`
          : 'Failed to load scan history — database may be unavailable'
      );
    } finally {
      setLoading(false);
    }
  }, [limit]);

  const deleteScan = useCallback(
    async (id: string) => {
      try {
        await scanRepository.delete(id);
        await refresh();
      } catch (err) {
        setError(
          err instanceof Error
            ? `Failed to delete scan: ${err.message}`
            : 'Failed to delete scan'
        );
      }
    },
    [refresh]
  );

  // Load scans on mount and whenever limit changes
  useEffect(() => {
    refresh().catch(() => {
      // Handled inside refresh
    });
  }, [refresh]);

  return {
    scans,
    loading,
    error,
    refresh,
    deleteScan,
    totalCount,
  };
}
