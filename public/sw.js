// PeanutGuard Service Worker — model caching + offline support
// Plain JS (not TypeScript) — runs outside webpack/Next.js

const CACHE_NAME = 'peanutguard-models-v1';
const DATA_CACHE = 'peanutguard-data-v1';

const MODEL_URLS = [
  '/models/peanut_gate.onnx',
  '/models/mobilenetv3_large.onnx',
  '/models/mobilenetv3_small.onnx',
  '/models/yolov11_nano.onnx',
];

const DATA_URLS = [
  '/data/disease_library.json',
  '/data/environmental_logic_config.json',
];

// Install: precache model and data files
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(async (cache) => {
        for (const url of MODEL_URLS) {
          try {
            const response = await fetch(url);
            if (response.ok) {
              await cache.put(url, response);
              notifyClients({ type: 'model-cached', url });
            }
          } catch {
            // Model files may not exist yet — skip gracefully
          }
        }
      }),
      caches.open(DATA_CACHE).then(async (cache) => {
        try {
          await cache.addAll(DATA_URLS);
        } catch {
          // Data files may not be available yet
        }
      }),
    ]).then(() => self.skipWaiting()),
  );
});

// Activate: clean old cache versions
self.addEventListener('activate', (event) => {
  const keepCaches = new Set([CACHE_NAME, DATA_CACHE]);
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => !keepCaches.has(name))
          .map((name) => caches.delete(name)),
      ),
    ).then(() => self.clients.claim()),
  );
});

// Fetch strategy: cache-first for models/data, network-first for API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Cache-first for model files
  if (url.pathname.startsWith('/models/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      }),
    );
    return;
  }

  // Cache-first for data files
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(DATA_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      }),
    );
    return;
  }

  // Network-first for API/function calls
  if (url.pathname.startsWith('/functions/') || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request)),
    );
    return;
  }
});

// Notify all clients of download progress
function notifyClients(message) {
  self.clients.matchAll({ type: 'window' }).then((clients) => {
    for (const client of clients) {
      client.postMessage(message);
    }
  });
}
