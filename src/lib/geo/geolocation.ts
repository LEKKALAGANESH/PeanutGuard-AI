import type { GeoLocation } from '@/types/desktop';

const TIMEOUT_MS = 10_000;

/**
 * Get current GPS position with high accuracy.
 * Returns null if permission denied or unavailable — GPS is optional.
 */
export function getCurrentPosition(): Promise<GeoLocation | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
      },
      () => {
        // PermissionDenied, PositionUnavailable, Timeout — all graceful
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: TIMEOUT_MS,
        maximumAge: 60_000, // accept 1-minute-old positions
      },
    );
  });
}

/**
 * Watch position continuously. Returns a cleanup function to stop watching.
 */
export function watchPosition(
  callback: (location: GeoLocation) => void,
): () => void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      callback({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
      });
    },
    () => {
      // Silently ignore errors during watch
    },
    {
      enableHighAccuracy: true,
      timeout: TIMEOUT_MS,
      maximumAge: 30_000,
    },
  );

  return () => navigator.geolocation.clearWatch(watchId);
}
