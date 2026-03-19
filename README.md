<p align="center">
  <img src="public/icons/icon-192.png" alt="PeanutGuard AI" width="80" height="80" />
</p>

<h1 align="center">PeanutGuard AI</h1>

<p align="center">
  <strong>Peanut crop disease detection & harvest optimization — 100% on-device, works offline.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> &middot;
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#testing">Testing</a> &middot;
  <a href="#project-structure">Structure</a> &middot;
  <a href="#tech-stack">Tech Stack</a> &middot;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/ONNX_Runtime-Web-orange?logo=onnx" alt="ONNX" />
  <img src="https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss" alt="Tailwind" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License" />
  <img src="https://img.shields.io/badge/Cost-%240%2Fmonth-brightgreen" alt="Zero Cost" />
</p>

---

## Features

- **19-class disease detection** (18 diseases + healthy) with severity grading (1-5)
- **100% on-device inference** via ONNX Runtime Web (WASM) — no cloud GPU, $0/month
- **3-stage AI pipeline**: Peanut Gate (2MB) -> MobileNetV3 classifier (8MB) -> YOLOv11 lesion detector (5MB)
- **Smart quality gatekeeper**: blur detection, exposure check, green + brown tissue coverage
- **Treatment recommendations**: organic, chemical, cultural practices with region-specific brands (IN/NG/US)
- **PDF report export**: client-side jsPDF with diagnosis, treatments, yield impact, confusion pair warnings
- **Voice query**: Web Speech API with Hindi + English fuzzy keyword matching
- **Harvest tracker**: disease pressure index, readiness scoring, field timeline
- **Desktop premium mode**: drag-drop bulk scanning, Web Worker parallelism, heatmap overlay, glassmorphism UI
- **Offline-first**: IndexedDB storage via Dexie, background Supabase sync, offline queue
- **Responsive**: phone (1-col) -> tablet (2-col) -> desktop (3-col premium) with 48px touch targets

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18.x or later
- npm 9+ (included with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/LEKKALAGANESH/PeanutGuard-AI.git
cd PeanutGuard-AI

# Install dependencies
npm install
```

### Environment Variables (optional)

Create a `.env.local` file for Supabase cloud sync (not required for local scanning):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

> Without these, the app runs fully offline in standalone mode. All scanning, diagnosis, and PDF export work without any cloud connection.

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

| Page | URL | Description |
|------|-----|-------------|
| Home | `/` | Dashboard with recent scans, field stats, desktop premium mode (lg+) |
| Scan | `/scan` | Camera capture -> 4-step AI pipeline -> results |
| Results | `/scan/result` | Disease diagnosis, treatments, PDF export |
| History | `/history` | All past scans from IndexedDB |
| Fields | `/fields` | Farm field management (name, planting date, variety) |
| Quality Tester | `/test-quality` | Batch test quality checks on uploaded images |

### Production Build

```bash
# Build optimized production bundle
npm run build

# Start production server
npm start
```

### Lint

```bash
npm run lint
```

---

## Testing

### 1. Full System Test (581 tests)

Tests file structure, disease library integrity, quality check pipeline, treatment engine, import chains, env config, TypeScript compilation, voice matcher, and stub detection.

```bash
# Requires: npm install canvas
node scripts/full_system_test.js
```

### 2. Batch Image Validation (17 test images)

Runs quality checks on all images in the `testing images/` folder. Outputs CSV (mobile), JSON (desktop), and failure log.

```bash
node scripts/batch_tester.js
```

Output files are written to `test_output/`:
- `batch_results.csv` — per-image quality metrics + treatment recommendations
- `batch_report.json` — structured JSON for programmatic consumption
- `failure_analysis.log` — detailed diagnostics for failed images

### 3. Quality Check Unit Test

Tests `checkImageQuality()` directly against every test image with augmentation impact analysis.

```bash
node scripts/test_quality_check.js
```

### 4. Disease + Treatment E2E Test

Validates filename -> disease label -> disease_library.json -> treatment output for all test images across IN/NG/US regions.

```bash
node scripts/e2e_disease_treatment_test.js
```

### 5. Browser-Based Quality Tester

Start the dev server and visit [http://localhost:3000/test-quality](http://localhost:3000/test-quality). All 17 test images auto-load and run through the real browser quality check pipeline with visual results.

---

## Project Structure

```
peanutguard/
├── public/
│   ├── models/                  # ONNX model files (4 placeholder files)
│   ├── testing-images/          # Test images served for browser testing
│   └── icons/                   # PWA icons
├── src/
│   ├── app/                     # Next.js App Router pages
│   │   ├── page.tsx             # Home (mobile + desktop premium)
│   │   ├── scan/                # Camera -> scan -> result flow
│   │   ├── history/             # Scan history
│   │   ├── fields/              # Field management
│   │   └── test-quality/        # Browser quality check tester
│   ├── components/
│   │   ├── scan/                # CameraCapture, ScanProcessor, QualityFeedback
│   │   ├── results/             # ResultCard, SeverityMeter, TreatmentAccordion
│   │   ├── desktop/             # BulkDropZone, ImageGrid, ZoomHeatmap, etc.
│   │   ├── pdf/                 # ExportButton
│   │   ├── voice/               # VoiceQueryButton
│   │   └── layout/              # AppShell, BottomNav
│   ├── lib/
│   │   ├── ai/                  # ONNX model loader, 3-stage inference engine
│   │   ├── preprocessing/       # Quality check, CLAHE, EXIF, augmentation
│   │   ├── treatments/          # Region-aware treatment engine
│   │   ├── db/                  # Dexie IndexedDB repositories
│   │   ├── pdf/                 # jsPDF report generator
│   │   ├── workers/             # Web Worker pool for parallel inference
│   │   ├── voice/               # Speech recognition, query matcher
│   │   ├── geo/                 # Geolocation API wrapper
│   │   ├── weather/             # Open-Meteo API client
│   │   ├── risk/                # Environmental risk calculator
│   │   ├── sync/                # Offline queue with retry
│   │   └── supabase/            # Supabase client + background sync
│   ├── hooks/                   # 10 React hooks
│   ├── stores/                  # 4 Zustand stores
│   ├── types/                   # TypeScript interfaces
│   ├── data/                    # disease_library.json, env config
│   └── styles/                  # globals.css, glassmorphism.css
├── scripts/                     # Test scripts (Node.js)
├── reports/                     # Strategy docs, specs, test output
└── testing images/              # 17 real peanut disease test images
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16 (App Router) | SSR/SSG, routing, PWA |
| Language | TypeScript 5 | Type safety |
| Styling | Tailwind CSS 4 | Utility-first responsive design |
| State | Zustand 5 | Lightweight global state (3KB) |
| AI Runtime | ONNX Runtime Web 1.24 | On-device WASM inference |
| Database | IndexedDB via Dexie 4 | Offline-first local storage |
| PDF | jsPDF 4 + html2canvas | Client-side report generation |
| Charts | Recharts 3 | Harvest trends, disease stats |
| Animations | Framer Motion 12 | Desktop premium UI transitions |
| Voice | Web Speech API | Browser-native speech recognition |
| Weather | Open-Meteo API | Disease risk correlation (free) |
| Cloud Sync | Supabase (FREE tier) | Optional metadata sync only |

### AI Models (19MB total)

| Model | Size | Purpose |
|-------|------|---------|
| Peanut Gate | ~2MB | Binary peanut/not-peanut classifier |
| MobileNetV3-Large | ~8MB | Primary 19-class disease classifier |
| MobileNetV3-Small | ~4MB | Fallback for <3GB RAM devices |
| YOLOv11-nano | ~5MB | Lesion bounding-box detection |

---

## Disease Classes

`healthy` `early_leaf_spot` `late_leaf_spot` `rust` `white_mold` `aspergillus_aflatoxin` `web_blotch` `collar_rot` `rosette_virus` `bud_necrosis` `peanut_mottle` `bacterial_wilt` `root_knot_nematode` `iron_chlorosis` `nitrogen_deficiency` `calcium_deficiency` `boron_deficiency` `drought_stress` `herbicide_injury`

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  Built for farmers. Runs on their phones. Costs them nothing.
</p>
