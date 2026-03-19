# PeanutGuard V1.0 — API Route Map

> **Version:** 1.0
> **Last Updated:** 2026-03-18
> **Architecture:** Frontend-only AI inference. No server-side model endpoints. All "API" routes are either Next.js client-side routes, lightweight Supabase Edge Functions, or browser-native APIs.

---

## 1. Architecture Principle

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER (100% on-device)                  │
│                                                             │
│  Camera API → Preprocessing → ONNX Runtime Web → Results   │
│       ↓              ↓              ↓              ↓        │
│  navigator.      Canvas 2D     Web Workers    IndexedDB    │
│  mediaDevices   OffscreenCanvas  (inference)   (Dexie)     │
│                                                             │
│  ── Only metadata crosses this line (optional, async) ──── │
│                         ↓                                   │
│              Supabase FREE Tier (Edge Functions)            │
└─────────────────────────────────────────────────────────────┘
```

**Rule:** No image data, no model weights, no inference computation touches a server.

---

## 2. Client-Side Routes (Next.js App Router)

### 2.1 Page Routes

| Route | Component | Purpose | Data Source |
|-------|-----------|---------|-------------|
| `/` | `app/page.tsx` | Home dashboard — recent scans, stats | IndexedDB |
| `/scan` | `app/scan/page.tsx` | Camera capture → scan pipeline | Camera API → ONNX |
| `/scan/result` | `app/scan/result/page.tsx` | Result display, treatments, export | Zustand store |
| `/history` | `app/history/page.tsx` | Scan history list | IndexedDB |
| `/fields` | `app/fields/page.tsx` | Field management (CRUD) | IndexedDB |
| `/desktop` | `app/desktop/page.tsx` | Desktop Premium bulk scan | Web Workers + IndexedDB |

### 2.2 Internal Data Flow (No HTTP — All In-Memory)

```
CameraCapture.tsx
  │ File (JPEG/PNG)
  ▼
useCamera.ts → useScan.ts
  │ ImageData
  ▼
preprocess.ts
  ├── exif.ts          (EXIF orientation fix)
  ├── quality-check.ts (blur/brightness gate)
  ├── clahe.ts         (contrast enhancement)
  └── normalize         (224×224, ImageNet mean/std, NCHW tensor)
  │ Float32Array
  ▼
inference.ts (InferenceEngine)
  ├── peanut_gate.onnx      → {isPeanut: bool, confidence: float}
  ├── mobilenetv3_large.onnx → {predictions: [{label, confidence}]}
  └── yolov11_nano.onnx      → {boxes: [{x,y,w,h,confidence,label}]}
  │ ScanResult
  ▼
scan-store.ts (Zustand)
  │
  ├─→ ResultCard.tsx (display)
  ├─→ TreatmentAccordion.tsx (via treatment-engine.ts + disease_library.json)
  ├─→ ExportButton.tsx (via report-generator.ts → jsPDF)
  ├─→ scan-repository.ts (persist to IndexedDB)
  └─→ sync.ts (optional metadata → Supabase)
```

---

## 3. Browser-Native APIs Used

| API | Module | Purpose | Fallback |
|-----|--------|---------|----------|
| `navigator.mediaDevices.getUserMedia()` | `useCamera.ts` | Camera access | File input gallery picker |
| `navigator.geolocation.getCurrentPosition()` | `geolocation.ts` (planned) | GPS for field location | Manual lat/lng entry |
| `navigator.deviceMemory` | `model-loader.ts` | RAM detection for model selection | Default to small model |
| `navigator.hardwareConcurrency` | `pool-manager.ts` (planned) | Worker count determination | Default 2 workers |
| `navigator.onLine` | `sync.ts` | Online/offline detection | Assume offline, queue sync |
| `navigator.storage.estimate()` | `cache-manager.ts` (planned) | Storage quota check | Warn at 50MB |
| `window.speechRecognition` | `speech-recognition.ts` | Voice-to-text | Fallback question buttons |
| `window.speechSynthesis` | `speech-recognition.ts` | Text-to-speech responses | Text-only display |
| `Cache API` | `sw.js` (planned) | ONNX model caching | Re-download on each visit |
| `IndexedDB` (via Dexie) | `db/index.ts` | All local persistence | N/A (required) |
| `OffscreenCanvas` | `preprocess-worker.ts` (planned) | Worker-based image processing | Main-thread canvas |
| `Web Workers` | `inference-worker.ts` (planned) | Parallel ONNX inference | Sequential main-thread |
| `Performance.memory` | `DesktopStatusBar.tsx` (planned) | RAM usage display (Chrome only) | Hide metric |

---

## 4. Supabase Edge Functions (Lightweight, Metadata Only)

These are the **only** server-side endpoints. All are optional — the app works fully offline without them.

### 4.1 Metadata Sync

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `POST /functions/v1/sync-scans` | POST | anon key | Upload batch of unsynced scan metadata |

**Request Body:**
```json
{
  "device_id": "uuid",
  "scans": [
    {
      "id": "uuid",
      "field_id": "uuid",
      "created_at": "ISO8601",
      "device_ram_gb": 4,
      "predictions": [
        {"label": "late_leaf_spot", "confidence": 0.87, "severity": 3}
      ]
    }
  ]
}
```

**Response:** `{ "synced": 5, "errors": [] }`

**Trigger:** Every 5 minutes when online (via `sync.ts`), or on app foreground.

### 4.2 Expert Review Submit

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `POST /functions/v1/submit-review` | POST | anon key | Submit expert review request |

**Request Body:** `ExpertReviewRequest` (see expert_validation_protocol.md §3)

**Response:** `{ "review_id": "uuid", "estimated_response": "24-48h" }`

### 4.3 Expert Review Check

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `GET /functions/v1/check-reviews?device_id=uuid` | GET | anon key | Poll for review responses |

**Response:**
```json
{
  "reviews": [
    {
      "scan_id": "uuid",
      "status": "confirmed",
      "reviewer_diagnosis": "late_leaf_spot",
      "reviewer_note": "Confirmed — typical late-season presentation",
      "reviewed_at": "ISO8601"
    }
  ]
}
```

**Trigger:** Every 30 minutes when online, if there are pending reviews.

### 4.4 Disease Prevalence Map (Anonymous)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `GET /functions/v1/disease-map?h3=<resolution>&region=<code>` | GET | anon key | Aggregated disease reports per H3 hex cell |

**Response:**
```json
{
  "cells": [
    {
      "h3_index": "872830828ffffff",
      "disease_counts": {"late_leaf_spot": 12, "rust": 5},
      "total_scans": 45,
      "last_updated": "ISO8601"
    }
  ]
}
```

**Privacy:** All GPS rounded to H3 resolution 5 (~253 km²). No individual scan data exposed.

---

## 5. External API Integrations

### 5.1 Open-Meteo Weather API (Client-Side, No Key Required)

| Endpoint | Purpose | Called From |
|----------|---------|------------|
| `GET https://api.open-meteo.com/v1/forecast?latitude=X&longitude=Y&hourly=temperature_2m,relative_humidity_2m,precipitation&past_days=14&forecast_days=3` | Weather history + forecast for environmental risk scoring | `weather-client.ts` (planned) |

**Rate Limit:** 10,000 requests/day (FREE, no API key).
**Fallback:** If API unreachable, environmental risk scoring is skipped — model confidence used alone.

### 5.2 Nominatim Reverse Geocoding (Optional)

| Endpoint | Purpose | Called From |
|----------|---------|------------|
| `GET https://nominatim.openstreetmap.org/reverse?lat=X&lon=Y&format=json` | Convert GPS to human-readable location name | `geolocation.ts` (planned) |

**Rate Limit:** 1 request/second (FREE, OSM policy).
**Usage:** Only on field creation, not per-scan.

---

## 6. Service Worker Routes (Planned)

```
sw.js
  ├── CACHE: /models/*.onnx          (Cache-first, 19MB total, immutable)
  ├── CACHE: /data/disease_library.json (Cache-first, ~200KB)
  ├── CACHE: /_next/static/**        (Cache-first, app bundle)
  ├── NETWORK: /functions/v1/**       (Network-first, fallback to queue)
  └── FALLBACK: /offline.html         (When both cache and network fail)
```

**Model Caching Strategy:**
1. On first visit: models downloaded and cached via Cache API
2. Subsequent visits: served from cache (zero network for inference)
3. Model updates: version check in `manifest.json` → cache-bust only changed models
4. Storage budget: ~25MB (19MB models + 5MB app + 1MB data)

---

## 7. Data Flow Summary

```
ZERO NETWORK REQUIRED:
  Camera → Preprocess → ONNX Inference → Results → IndexedDB → PDF Export

OPTIONAL NETWORK (metadata only):
  IndexedDB → sync.ts → Supabase sync-scans (2KB/scan)
  Result → expert review → Supabase submit-review (35KB/review)
  GPS → Open-Meteo → environmental risk adjustment

NEVER OVER NETWORK:
  ✗ Raw images
  ✗ Model weights (after initial cache)
  ✗ Inference computation
  ✗ Personal information
```

---

## 8. Desktop Premium Additional Routes

| Internal Flow | Purpose |
|---------------|---------|
| `Main Thread → pool-manager.ts → inference-worker.ts (×N)` | Parallel bulk inference via Web Worker message passing |
| `Main Thread → preprocess-worker.ts` | Offscreen image preprocessing |
| `Main Thread → pdf-worker.ts` | Background batch PDF generation |
| `BulkDropZone → useBulkScan → pool-manager → results → bulk-scan-store` | Desktop bulk scan data pipeline |

No additional server endpoints. Desktop Premium is 100% client-side parallel processing.
