import type { WeatherData } from '@/types/desktop';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** In-memory cache keyed by rounded lat/lng. */
const cache = new Map<string, { data: WeatherData; expiresAt: number }>();

function cacheKey(lat: number, lng: number): string {
  // Round to 2 decimal places (~1km resolution) for cache deduplication
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

/**
 * Fetch current weather conditions from Open-Meteo.
 * Returns null if the API is unreachable — weather is optional for inference.
 */
export async function fetchWeather(
  lat: number,
  lng: number,
): Promise<WeatherData | null> {
  const key = cacheKey(lat, lng);
  const cached = cache.get(key);

  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      current: 'temperature_2m,relative_humidity_2m,precipitation',
      hourly: 'soil_moisture_0_to_7cm',
      daily: 'precipitation_sum',
      timezone: 'auto',
      past_days: '7',
      forecast_days: '1',
    });

    const response = await fetch(`${BASE_URL}?${params}`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    const current = json.current;
    const hourly = json.hourly;
    const daily = json.daily;

    // Get most recent soil moisture value
    const soilMoistureValues: number[] = hourly?.soil_moisture_0_to_7cm ?? [];
    const latestSoilMoisture =
      soilMoistureValues.length > 0
        ? soilMoistureValues[soilMoistureValues.length - 1]
        : 0;

    // Sum weekly rainfall from daily precipitation_sum (past 7 days)
    const dailyPrecip: number[] = daily?.precipitation_sum ?? [];
    const rainfallWeeklyMm = dailyPrecip.reduce((sum, v) => sum + (v ?? 0), 0);

    const data: WeatherData = {
      temperature: current?.temperature_2m ?? 0,
      humidity: current?.relative_humidity_2m ?? 0,
      precipitation: current?.precipitation ?? 0,
      soilMoisture: latestSoilMoisture,
      rainfallWeeklyMm,
      fetchedAt: Date.now(),
    };

    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });

    return data;
  } catch (err) {
    // Log error type for debugging but return null (weather is non-critical)
    if (typeof console !== 'undefined') {
      const msg = err instanceof Error ? err.message : String(err);
      const isTimeout = msg.includes('abort') || msg.includes('timeout');
      console.warn(
        `[PeanutGuard] Weather fetch failed (${isTimeout ? 'timeout' : 'network'}): ${msg}`
      );
    }
    return null;
  }
}
