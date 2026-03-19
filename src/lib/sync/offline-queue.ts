import { db } from '@/lib/db/index';

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;

export interface SyncAction {
  type: 'upload_scan' | 'update_field' | 'delete_scan';
  payload: Record<string, unknown>;
}

/**
 * Enqueue a sync action for later processing when online.
 */
export async function enqueueSyncAction(action: SyncAction): Promise<void> {
  await db.table('syncQueue').add({
    id: crypto.randomUUID(),
    action: action.type,
    payload: action.payload,
    status: 'pending',
    retries: 0,
    createdAt: Date.now(),
  });
}

/**
 * Process all pending sync actions with exponential backoff retry.
 */
export async function processSyncQueue(): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  const pending = await db
    .table('syncQueue')
    .filter((item: { status: string; retries: number }) =>
      item.status === 'pending' && item.retries < MAX_RETRIES,
    )
    .toArray();

  for (const item of pending) {
    try {
      await executeSyncAction(item.action, item.payload);
      await db.table('syncQueue').delete(item.id);
      processed++;
    } catch {
      const retries = item.retries + 1;
      if (retries >= MAX_RETRIES) {
        await db.table('syncQueue').update(item.id, { status: 'failed', retries });
        failed++;
      } else {
        await db.table('syncQueue').update(item.id, { retries });
        // Wait with exponential backoff before next retry
        await new Promise((r) => setTimeout(r, BACKOFF_BASE_MS * Math.pow(2, retries - 1)));
      }
    }
  }

  return { processed, failed };
}

/**
 * Set up auto-processing when the browser comes back online.
 */
export function setupOnlineListener(): () => void {
  const handler = () => {
    processSyncQueue().catch(() => {
      // Silently ignore errors during auto-sync
    });
  };

  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}

/**
 * Execute a single sync action against Supabase Edge Functions.
 * Routes each action type to the appropriate endpoint.
 */
async function executeSyncAction(
  action: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!navigator.onLine) {
    throw new Error('Device is offline — sync will retry when connected');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured, skip sync gracefully (zero-cost mode)
  if (!supabaseUrl || !supabaseKey) {
    return;
  }

  const endpointMap: Record<string, string> = {
    upload_scan: '/functions/v1/sync-scans',
    update_field: '/functions/v1/sync-scans',
    delete_scan: '/functions/v1/sync-scans',
  };

  const endpoint = endpointMap[action];
  if (!endpoint) {
    throw new Error(`Unknown sync action: ${action}`);
  }

  const response = await fetch(`${supabaseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
    },
    body: JSON.stringify({ action, ...payload }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Sync failed (${response.status}): ${text}`);
  }
}
