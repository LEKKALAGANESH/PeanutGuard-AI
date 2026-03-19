# PeanutGuard V1.0 — Final Project Checklist

> **Version:** 1.0
> **Last Updated:** 2026-03-18
> **Status Legend:** ✅ Done | 🔨 Scaffolded (needs refinement) | ❌ Missing | 🔄 Needs Update

---

## A. Existing Source Files (41 files — Audit Results)

### A1. App Pages
| # | File | Status | Notes |
|---|------|--------|-------|
| 1 | `src/app/layout.tsx` | ✅ | Root layout, PWA metadata |
| 2 | `src/app/page.tsx` | ✅ | Home dashboard |
| 3 | `src/app/scan/page.tsx` | ✅ | Camera → scan flow |
| 4 | `src/app/scan/result/page.tsx` | ✅ | Result display |
| 5 | `src/app/history/page.tsx` | ✅ | Scan history list |
| 6 | `src/app/fields/page.tsx` | ✅ | Field management |

### A2. Layout Components
| # | File | Status | Notes |
|---|------|--------|-------|
| 7 | `src/components/layout/AppShell.tsx` | ✅ | Conditional nav |
| 8 | `src/components/layout/BottomNav.tsx` | ✅ | 4-tab mobile nav |

### A3. Scan Pipeline
| # | File | Status | Notes |
|---|------|--------|-------|
| 9 | `src/components/scan/CameraCapture.tsx` | ✅ | WebRTC + gallery |
| 10 | `src/components/scan/ScanProcessor.tsx` | ✅ | 4-step pipeline UI |
| 11 | `src/components/scan/QualityFeedback.tsx` | ✅ | Quality issue display |

### A4. Result Components
| # | File | Status | Notes |
|---|------|--------|-------|
| 12 | `src/components/results/ResultCard.tsx` | ✅ | Predictions + boxes |
| 13 | `src/components/results/SeverityMeter.tsx` | ✅ | 5-level meter |
| 14 | `src/components/results/TreatmentAccordion.tsx` | ✅ | 3-section treatments |

### A5. PDF & Voice
| # | File | Status | Notes |
|---|------|--------|-------|
| 15 | `src/components/pdf/ExportButton.tsx` | ✅ | jsPDF client-side |
| 16 | `src/components/voice/VoiceQueryButton.tsx` | ✅ | Web Speech API |

### A6. AI Pipeline
| # | File | Status | Notes |
|---|------|--------|-------|
| 17 | `src/lib/ai/index.ts` | ✅ | High-level AI API |
| 18 | `src/lib/ai/model-loader.ts` | ✅ | ONNX session mgmt |
| 19 | `src/lib/ai/inference.ts` | ✅ | InferenceEngine (gate, classify, detect) |
| 20 | `src/lib/ai/labels.ts` | ✅ | 19 disease labels |

### A7. Preprocessing
| # | File | Status | Notes |
|---|------|--------|-------|
| 21 | `src/lib/preprocessing/preprocess.ts` | ✅ | Full pipeline |
| 22 | `src/lib/preprocessing/quality-check.ts` | ✅ | Blur + brightness |
| 23 | `src/lib/preprocessing/clahe.ts` | ✅ | Pure TS CLAHE |
| 24 | `src/lib/preprocessing/exif.ts` | ✅ | EXIF orientation |
| 25 | `src/lib/preprocessing/index.ts` | ✅ | Barrel export |

### A8. Treatment Engine
| # | File | Status | Notes |
|---|------|--------|-------|
| 26 | `src/lib/treatments/treatment-engine.ts` | ✅ | Region-aware mapping |

### A9. Database & Sync
| # | File | Status | Notes |
|---|------|--------|-------|
| 27 | `src/lib/db/index.ts` | ✅ | Dexie schema |
| 28 | `src/lib/db/scan-repository.ts` | ✅ | Scan CRUD |
| 29 | `src/lib/db/field-repository.ts` | ✅ | Field CRUD |
| 30 | `src/lib/supabase/client.ts` | ✅ | Supabase init |
| 31 | `src/lib/supabase/sync.ts` | ✅ | Metadata sync |

### A10. Voice
| # | File | Status | Notes |
|---|------|--------|-------|
| 32 | `src/lib/voice/speech-recognition.ts` | ✅ | Web Speech wrapper |
| 33 | `src/lib/voice/query-matcher.ts` | ✅ | Fuzzy keyword match |

### A11. Hooks
| # | File | Status | Notes |
|---|------|--------|-------|
| 34 | `src/hooks/useCamera.ts` | ✅ | Camera lifecycle |
| 35 | `src/hooks/useScan.ts` | ✅ | Scan orchestration |
| 36 | `src/hooks/useHistory.ts` | ✅ | History management |

### A12. State Stores
| # | File | Status | Notes |
|---|------|--------|-------|
| 37 | `src/stores/scan-store.ts` | ✅ | Zustand scan state |
| 38 | `src/stores/user-store.ts` | ✅ | User prefs (persisted) |

### A13. Types & Data
| # | File | Status | Notes |
|---|------|--------|-------|
| 39 | `src/types/index.ts` | ✅ | All TS interfaces |
| 40 | `src/types/minimatch.d.ts` | ✅ | Type stub |
| 41 | `src/data/disease_library.json` | ✅ | 19 diseases, complete |

### A14. Config Files
| # | File | Status | Notes |
|---|------|--------|-------|
| 42 | `package.json` | ✅ | All deps listed |
| 43 | `tsconfig.json` | ✅ | |
| 44 | `next.config.ts` | ✅ | |
| 45 | `postcss.config.mjs` | ✅ | |
| 46 | `eslint.config.mjs` | ✅ | |
| 47 | `src/app/globals.css` | ✅ | Tailwind base |

---

## B. Missing Files — Required for V1.0

### B1. ONNX Model Files (Training Required)
| # | File | Size | Status | Dependency |
|---|------|------|--------|------------|
| 48 | `public/models/peanut_gate.onnx` | ~2MB | ❌ | Binary peanut/not-peanut classifier |
| 49 | `public/models/mobilenetv3_large.onnx` | ~8MB | ❌ | Primary 19-class disease classifier |
| 50 | `public/models/mobilenetv3_small.onnx` | ~4MB | ❌ | Fallback classifier (<3GB RAM) |
| 51 | `public/models/yolov11_nano.onnx` | ~5MB | ❌ | Lesion bounding-box detection |

### B2. Environmental / GPS / Weather Integration
| # | File | Status | Purpose |
|---|------|--------|---------|
| 52 | `src/lib/geo/geolocation.ts` | ❌ | GPS capture via `navigator.geolocation`, auto-fill field lat/lng |
| 53 | `src/lib/geo/weather-client.ts` | ❌ | Open-Meteo API: fetch temp, humidity, rainfall for GPS coords |
| 54 | `src/lib/geo/environmental-risk.ts` | ❌ | Map weather + GPS → disease probability using Bayesian priors |
| 55 | `src/data/environmental_logic_config.json` | ❌ | Disease-to-climate trigger mappings (from disease library) |

### B3. Service Worker & Offline
| # | File | Status | Purpose |
|---|------|--------|---------|
| 56 | `public/sw.js` (or `src/service-worker.ts`) | ❌ | Custom service worker: model caching, offline page, sync queue |
| 57 | `src/lib/offline/cache-manager.ts` | ❌ | Cache API management for ONNX models (19MB) + disease library |
| 58 | `src/lib/offline/sync-queue.ts` | ❌ | IndexedDB-backed queue for deferred Supabase sync |

### B4. Desktop Premium — Bulk Scan Components
| # | File | Status | Purpose |
|---|------|--------|---------|
| 59 | `src/app/desktop/page.tsx` | ❌ | Desktop Premium entry point |
| 60 | `src/app/desktop/layout.tsx` | ❌ | Desktop layout (sidebar, no BottomNav) |
| 61 | `src/components/desktop/BulkDropZone.tsx` | ❌ | Drag-and-drop (files + folders) |
| 62 | `src/components/desktop/BulkImageGrid.tsx` | ❌ | Virtualized image grid with status overlays |
| 63 | `src/components/desktop/ImageCard.tsx` | ❌ | Individual card with scan state machine |
| 64 | `src/components/desktop/ComparisonPanel.tsx` | ❌ | Side-by-side / overlay comparison |
| 65 | `src/components/desktop/ZoomHeatmap.tsx` | ❌ | Canvas zoom + CAM heatmap overlay |
| 66 | `src/components/desktop/BatchSidebar.tsx` | ❌ | Queue list + stats + filters |
| 67 | `src/components/desktop/DesktopStatusBar.tsx` | ❌ | Worker pool & performance metrics |
| 68 | `src/components/desktop/DesktopTopBar.tsx` | ❌ | Top navigation bar |
| 69 | `src/components/desktop/BatchSummaryBanner.tsx` | ❌ | Completion notification banner |
| 70 | `src/components/desktop/ContextMenu.tsx` | ❌ | Right-click menu |

### B5. Web Worker Infrastructure
| # | File | Status | Purpose |
|---|------|--------|---------|
| 71 | `src/lib/workers/pool-manager.ts` | ❌ | Worker lifecycle, queue, backpressure |
| 72 | `src/lib/workers/inference-worker.ts` | ❌ | ONNX inference in Web Worker |
| 73 | `src/lib/workers/preprocess-worker.ts` | ❌ | Image preprocessing in Web Worker |
| 74 | `src/lib/workers/pdf-worker.ts` | ❌ | Batch PDF generation in Web Worker |

### B6. Desktop Hooks
| # | File | Status | Purpose |
|---|------|--------|---------|
| 75 | `src/hooks/useBulkScan.ts` | ❌ | Bulk scan lifecycle orchestration |
| 76 | `src/hooks/useWorkerPool.ts` | ❌ | React hook for worker pool state |
| 77 | `src/hooks/useHeatmap.ts` | ❌ | CAM generation + canvas rendering |
| 78 | `src/hooks/useImageZoom.ts` | ❌ | Zoom/pan state & mouse handlers |
| 79 | `src/hooks/useKeyboardShortcuts.ts` | ❌ | Desktop keyboard shortcut handler |
| 80 | `src/hooks/useBatchExport.ts` | ❌ | PDF/CSV/ZIP export orchestration |

### B7. Desktop Stores
| # | File | Status | Purpose |
|---|------|--------|---------|
| 81 | `src/stores/bulk-scan-store.ts` | ❌ | Zustand store for bulk scan queue & results |
| 82 | `src/stores/desktop-ui-store.ts` | ❌ | Panel visibility, view mode, filters |

### B8. Styles
| # | File | Status | Purpose |
|---|------|--------|---------|
| 83 | `src/styles/glassmorphism.css` | ❌ | Glass panel utility classes |

### B9. Expert Validation
| # | File | Status | Purpose |
|---|------|--------|---------|
| 84 | `src/components/results/ExpertReviewRequest.tsx` | ❌ | UI for requesting human expert review |
| 85 | `src/lib/expert/review-protocol.ts` | ❌ | Logic: package scan data for expert review |

### B10. Internationalization
| # | File | Status | Purpose |
|---|------|--------|---------|
| 86 | `src/i18n/en.json` | ❌ | English UI strings |
| 87 | `src/i18n/hi.json` | ❌ | Hindi UI strings |
| 88 | `src/i18n/te.json` | ❌ | Telugu UI strings |
| 89 | `src/lib/i18n/config.ts` | ❌ | next-intl configuration |

### B11. Additional Dependencies (to add to package.json)
| Package | Purpose | Status |
|---------|---------|--------|
| `framer-motion` | Desktop Premium animations | ❌ Not installed |
| `jszip` | Heatmap gallery ZIP export | ❌ Not installed |
| `@tanstack/react-virtual` | Virtualized grid for 500+ images | ❌ Not installed |

---

## C. Specification Documents

### C1. Existing
| # | File | Status |
|---|------|--------|
| D1 | `architecture_flow.md` | ✅ |
| D2 | `peanut_disease_library.md` | ✅ |
| D3 | `farmer_needs_analysis.md` | ✅ |
| D4 | `sprint_backlog_v1.md` | 🔄 Has contradictions (EfficientNetV2-S, @react-pdf) — needs alignment with codebase |
| D5 | `PeanutGuard_Execution_Strategy.md` | ✅ |

### C2. New (Created This Session)
| # | File | Status |
|---|------|--------|
| D6 | `desktop_premium_ui_spec.md` | ✅ Created |
| D7 | `final_project_checklist.md` | ✅ This file |
| D8 | `environmental_logic_config.json` | ✅ Created |
| D9 | `expert_validation_protocol.md` | ✅ Created |
| D10 | `api_route_map.md` | ✅ Created |

---

## D. Summary Statistics

| Category | Done | Scaffolded | Missing | Total |
|----------|------|------------|---------|-------|
| App Pages | 6 | 0 | 2 | 8 |
| Components | 8 | 0 | 12 | 20 |
| Lib Modules | 17 | 0 | 12 | 29 |
| Hooks | 3 | 0 | 6 | 9 |
| Stores | 2 | 0 | 2 | 4 |
| Data/Config | 2 | 0 | 2 | 4 |
| Types | 2 | 0 | 0 | 2 |
| Styles | 1 | 0 | 1 | 2 |
| i18n | 0 | 0 | 4 | 4 |
| Workers | 0 | 0 | 4 | 4 |
| Models | 0 | 0 | 4 | 4 |
| **TOTAL** | **41** | **0** | **49** | **90** |

**Completion: 45.6% (41/90 files)**
**To reach V1.0: 49 files remaining**

---

## E. Implementation Priority Order

### Phase 1: Core Infrastructure (Unblocks everything)
1. ONNX model training pipeline + export (files 48-51)
2. Service Worker + offline cache (files 56-58)
3. GPS + Weather integration (files 52-55)

### Phase 2: Desktop Premium MVP
4. Web Worker pool infrastructure (files 71-74)
5. Desktop stores (files 81-82)
6. Desktop hooks (files 75-80)
7. Install `framer-motion`, `jszip`, `@tanstack/react-virtual`

### Phase 3: Desktop Premium UI
8. Desktop layout + entry point (files 59-60)
9. BulkDropZone + BulkImageGrid + ImageCard (files 61-63)
10. Glassmorphism styles (file 83)
11. ComparisonPanel + ZoomHeatmap (files 64-65)
12. BatchSidebar + StatusBar + TopBar (files 66-68)
13. BatchSummaryBanner + ContextMenu (files 69-70)

### Phase 4: Polish & Extras
14. Expert validation flow (files 84-85)
15. Internationalization (files 86-89)
16. Sprint backlog v2 (align D4 contradictions)

---

## F. Known Contradictions to Resolve

| Issue | sprint_backlog_v1.md Says | Codebase Uses | Resolution |
|-------|---------------------------|---------------|------------|
| Primary model | EfficientNetV2-S | MobileNetV3-Large | **Codebase is correct** — update sprint doc |
| PDF library | @react-pdf/renderer | jsPDF + html2canvas | **Codebase is correct** — update sprint doc |
| Server PDF | WeasyPrint | N/A (client-only) | **Remove** — violates Zero-Cost |
| Dataset | PlantVillage | N/A (models not trained) | **Use ICRISAT + Pak-Nuts + custom** — PlantVillage has 0 peanut images |
| Whisper size | ~150MB (farmer_needs) | ~40MB (architecture) | **40MB is correct** — Whisper-tiny quantized |
