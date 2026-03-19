'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { BottomNav } from './BottomNav';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullscreen = pathname.startsWith('/scan');

  // Start background sync when app mounts (online listener + periodic sync)
  useEffect(() => {
    let cleanupSync: (() => void) | null = null;
    let cleanupOnline: (() => void) | null = null;

    import('@/lib/supabase/sync').then(({ startBackgroundSync }) => {
      cleanupSync = startBackgroundSync();
    }).catch(() => {
      // Supabase not configured — skip background sync
    });

    import('@/lib/sync/offline-queue').then(({ setupOnlineListener }) => {
      cleanupOnline = setupOnlineListener();
    }).catch(() => {
      // Offline queue not available
    });

    return () => {
      cleanupSync?.();
      cleanupOnline?.();
    };
  }, []);

  return (
    <>
      {children}
      {!isFullscreen && <BottomNav />}
    </>
  );
}
