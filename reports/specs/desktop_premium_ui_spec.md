# PeanutGuard Desktop Premium — "Drag & Drop Elite" UI Specification

> **Version:** 1.0
> **Last Updated:** 2026-03-18
> **Constraint:** 100% browser-side. Zero server processing. Zero-Cost rule inviolable.

---

## 1. Design Philosophy

**Inspiration:** Adobe Lightroom meets agricultural science. Professional-grade diagnostic tooling that a commercial farm manager, agronomist, or drone operator can trust for high-throughput field analysis.

**Core Principles:**
- **Glassmorphism:** Frosted-glass panels with `backdrop-filter: blur(16px)` over a dark agricultural-themed background
- **Progressive Disclosure:** Simple on arrival, powerful on demand
- **Real-time Feedback:** Every image shows scanning progress individually
- **Zero-Cost Compliance:** All inference via Web Workers + ONNX Runtime Web. No cloud calls.

---

## 2. Layout Architecture

### 2.1 Desktop Breakpoint Detection

```
Mobile:   < 768px  → Standard PeanutGuard mobile UI (existing)
Tablet:   768-1279px → Hybrid mode (2-column, drag-drop enabled)
Desktop:  ≥ 1280px → Full "Desktop Premium" mode
```

### 2.2 Desktop Premium Layout (≥1280px)

```
┌─────────────────────────────────────────────────────────────────┐
│  TOP BAR (64px)                                                 │
│  [PeanutGuard Pro]  [Dashboard] [Bulk Scan] [Fields] [History]  │
│                                          [Settings] [Export All]│
├──────────┬──────────────────────┬───────────────────────────────┤
│          │                      │                               │
│  LEFT    │   CENTER STAGE       │   RIGHT PANEL                 │
│  SIDEBAR │   (Main Workspace)   │   (Detail Inspector)          │
│  (280px) │   (Flex-grow)        │   (380px, collapsible)        │
│          │                      │                               │
│  Upload  │   Image Grid /       │   Selected Image Detail:      │
│  Queue   │   Comparison View    │   - Zoom + Heatmap            │
│          │                      │   - Disease Card              │
│  Batch   │   Drag-Drop Zone     │   - Severity Meter            │
│  Stats   │   (when empty)       │   - Treatment Accordion       │
│          │                      │   - Yield Impact              │
│  Filter  │                      │   - Export Single PDF          │
│  Panel   │                      │                               │
├──────────┴──────────────────────┴───────────────────────────────┤
│  BOTTOM STATUS BAR (40px)                                       │
│  [Workers: 4/4] [Queue: 23/100] [Avg: 340ms/img] [RAM: 1.2GB]  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Specifications

### 3.1 Drag-and-Drop Zone (`BulkDropZone.tsx`)

**States:**
| State | Visual | Behavior |
|-------|--------|----------|
| **Empty** | Large dashed border (2px, `#4ADE80`), pulsing leaf icon | "Drop images here or click to browse" |
| **Drag-Over** | Border solidifies, glassmorphism panel glows green, scale(1.02) | `e.preventDefault()`, file type validation |
| **Processing** | Transforms into grid view with progress overlays | Individual image cards appear as files are queued |
| **Complete** | Summary banner slides down from top | "100 images scanned. 23 diseased. View report →" |

**Accepted Inputs:**
- File types: `.jpg`, `.jpeg`, `.png`, `.webp`, `.bmp`, `.tiff`
- Max per batch: 500 images (soft limit, warning at 200+)
- Max file size: 20MB per image (skip with warning if exceeded)
- Folder drop: Recursively extract images (via `webkitGetAsEntry()`)
- Drone formats: DJI `.JPG` with GPS EXIF preserved

**Framer Motion Animations:**
```typescript
// Drop zone pulse (idle state)
const pulseVariants = {
  idle: { scale: [1, 1.01, 1], opacity: [0.6, 0.8, 0.6] },
  transition: { duration: 2, repeat: Infinity, ease: "easeInOut" }
}

// Image card entrance (staggered grid)
const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.03, duration: 0.3, ease: "easeOut" }
  })
}

// Scanning overlay on individual card
const scanOverlay = {
  scanning: {
    background: [
      "linear-gradient(180deg, transparent 0%, rgba(74,222,128,0.3) 50%, transparent 100%)",
    ],
    backgroundPosition: ["0% -100%", "0% 200%"],
    transition: { duration: 1.5, repeat: Infinity }
  }
}
```

### 3.2 Image Grid (`BulkImageGrid.tsx`)

**Layout:** CSS Grid with `auto-fill`, `minmax(180px, 1fr)`, gap `12px`.

**Card States:**
| State | Overlay | Badge |
|-------|---------|-------|
| **Queued** | Dimmed (opacity 0.5) | Clock icon, queue position |
| **Preprocessing** | Blue shimmer sweep | "Checking quality..." |
| **Gate Check** | Green shimmer sweep | "Verifying peanut..." |
| **Classifying** | Amber shimmer sweep | "Diagnosing..." |
| **Detecting** | Purple shimmer sweep | "Mapping lesions..." |
| **Complete — Healthy** | Green border glow | ✓ "Healthy" pill badge |
| **Complete — Diseased** | Red/amber border glow | Disease name + severity dot |
| **Failed — Not Peanut** | Gray, crossed-out | "Not peanut leaf" |
| **Failed — Low Quality** | Yellow border | "Blurry/Dark — retake" |

**Interactions:**
- Click: Select → show in Right Panel detail inspector
- Shift+Click: Range select
- Ctrl+Click: Multi-select
- Right-click: Context menu (Re-scan, Remove, Export PDF, Copy result)
- Double-click: Open full-screen comparison view

### 3.3 Comparison View (`ComparisonPanel.tsx`)

**Mode 1: Side-by-Side**
```
┌─────────────────────┬─────────────────────┐
│                     │                     │
│   HEALTHY REF       │   SELECTED IMAGE    │
│   (from library)    │   (user's scan)     │
│                     │                     │
│   [disease name     │   [lesion boxes]    │
│    reference photo]  │   [heatmap overlay] │
│                     │                     │
└─────────────────────┴─────────────────────┘
         ← Sync zoom & pan (Ctrl+scroll) →
```

**Mode 2: Overlay Toggle**
- Slider to blend between original image and Grad-CAM heatmap (0-100%)
- Keyboard shortcut: `H` to toggle heatmap, `B` to toggle bounding boxes

**Mode 3: Before/After Slider**
- Vertical drag-bar splitting original vs. annotated view
- Framer Motion `drag="x"` with constraints

### 3.4 Zoom-Heatmap Inspector (`ZoomHeatmap.tsx`)

**Technology:** Canvas 2D overlay on original image.

**Heatmap Generation (100% client-side):**
- **Method:** Class Activation Mapping (CAM) derived from the final conv layer of MobileNetV3
- **Process:**
  1. Extract feature maps from penultimate ONNX layer (output: `feature_map` tensor)
  2. Weight by classification layer weights for predicted class
  3. Resize activation map to original image dimensions (bilinear interpolation)
  4. Apply colormap (Viridis: blue=low activation → yellow=high activation)
  5. Composite over original image at user-controlled opacity

**Zoom Controls:**
- Mouse wheel: 1x → 2x → 4x → 8x zoom
- Click-drag to pan (cursor: grab/grabbing)
- Minimap in corner showing viewport position
- Keyboard: `+`/`-` for zoom, arrow keys for pan

**Lesion Box Overlay:**
- YOLOv11-nano bounding boxes rendered as SVG `<rect>` elements
- Color-coded by confidence: green (>80%), yellow (60-80%), red (<60%)
- Hover shows tooltip: `"Late Leaf Spot — 87% confidence — Severity: 3/5"`

### 3.5 Left Sidebar — Batch Statistics (`BatchSidebar.tsx`)

**Upload Queue Section:**
- Vertical list of thumbnail strips (48×48px)
- Drag to reorder priority
- Color-coded status dots (same as grid)
- "Pause Queue" / "Resume" / "Clear All" buttons

**Batch Analytics Section (Recharts):**
- **Donut Chart:** Disease distribution (count per class)
- **Bar Chart:** Severity distribution (1-5 levels)
- **Stat Cards:**
  - Total scanned: `87/100`
  - Healthy: `64 (73.6%)`
  - Diseased: `23 (26.4%)`
  - Not peanut: `0`
  - Quality rejected: `0`
  - Avg inference time: `340ms`

**Filter Panel:**
- Filter grid by: Disease type, Severity level, Confidence range, Quality score
- Sort by: Filename, Scan order, Severity (desc), Confidence (desc)

### 3.6 Status Bar (`DesktopStatusBar.tsx`)

**Always visible at bottom. Real-time metrics.**

```
[●●●●○○○○ Workers: 4/8]  [Queue: 23/100 ▰▰▰▰▰▱▱▱▱▱]  [Avg: 340ms/img]  [ETA: 8s]  [RAM: 1.2/4.0 GB]  [GPU: WebGL ✓]
```

- Worker dots: filled = active, empty = idle
- Queue: progress bar with count
- RAM: estimated from `performance.memory` (Chrome) or `navigator.deviceMemory`
- GPU: WebGL/WebGPU backend indicator

---

## 4. Web Worker Architecture — Parallel Inference Engine

### 4.1 Worker Pool Design

```
Main Thread (UI)
  │
  ├─── WorkerPool Manager (src/lib/workers/pool-manager.ts)
  │       │
  │       ├── Worker 0 (inference-worker.ts) ── ONNX Session (shared model)
  │       ├── Worker 1 (inference-worker.ts) ── ONNX Session (shared model)
  │       ├── Worker 2 (inference-worker.ts) ── ONNX Session (shared model)
  │       └── Worker N (inference-worker.ts) ── ONNX Session (shared model)
  │
  ├─── Preprocessing Worker (preprocess-worker.ts)
  │       Canvas OffscreenCanvas for CLAHE + resize
  │
  └─── UI Render Loop (requestAnimationFrame)
          Grid updates, progress bars, heatmap draws
```

**Worker Count:** `Math.min(navigator.hardwareConcurrency - 1, 6)` — reserve 1 core for UI.

### 4.2 Message Protocol

```typescript
// Main → Worker
type WorkerCommand =
  | { type: 'INIT'; modelUrl: string; backend: 'wasm' | 'webgl' }
  | { type: 'INFER'; id: string; imageData: ArrayBuffer; width: number; height: number }
  | { type: 'TERMINATE' }

// Worker → Main
type WorkerResult =
  | { type: 'READY' }
  | { type: 'PROGRESS'; id: string; phase: 'gate' | 'classify' | 'detect' }
  | { type: 'RESULT'; id: string; result: ScanResult }
  | { type: 'ERROR'; id: string; error: string }
  | { type: 'CAM'; id: string; heatmapData: ArrayBuffer; width: number; height: number }
```

### 4.3 Data Transfer Strategy

- **Images:** Transferred as `ArrayBuffer` via `postMessage(data, [data])` (transferable — zero-copy)
- **Model files:** Each worker loads its own ONNX session from `/public/models/` (cached by browser after first load)
- **Heatmap data:** Returned as `ArrayBuffer` (transferable), rendered on main thread canvas

### 4.4 Queue Management

```typescript
interface QueueItem {
  id: string;
  file: File;
  status: 'queued' | 'preprocessing' | 'inferring' | 'complete' | 'error';
  priority: number;        // Lower = higher priority (drag-to-reorder)
  result?: ScanResult;
  heatmapBuffer?: ArrayBuffer;
  startTime?: number;
  endTime?: number;
}
```

- FIFO by default, drag-to-reorder adjusts priority
- Backpressure: if all workers busy, items wait in queue
- Cancel: remove from queue or terminate worker mid-inference (non-blocking)
- Retry: failed items auto-retry once, then mark as error

---

## 5. Glassmorphism Design System

### 5.1 CSS Custom Properties

```css
:root {
  /* Glassmorphism base */
  --glass-bg: rgba(15, 23, 42, 0.75);
  --glass-border: rgba(148, 163, 184, 0.15);
  --glass-blur: 16px;
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);

  /* Accent colors */
  --peanut-green: #4ADE80;
  --peanut-amber: #FBBF24;
  --peanut-red: #F87171;
  --peanut-blue: #60A5FA;
  --peanut-purple: #A78BFA;

  /* Status colors */
  --status-healthy: #22C55E;
  --status-mild: #EAB308;
  --status-moderate: #F97316;
  --status-severe: #EF4444;
  --status-critical: #DC2626;

  /* Typography */
  --font-display: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
```

### 5.2 Glass Panel Component

```css
.glass-panel {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  box-shadow: var(--glass-shadow);
}

.glass-panel-elevated {
  background: rgba(15, 23, 42, 0.85);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
}
```

### 5.3 Background

- Dark gradient base: `linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)`
- Subtle animated mesh gradient (CSS `@property` animation) — organic, plant-themed
- Optional: blurred aerial field photo at 5% opacity as texture

---

## 6. Framer Motion Transition Map

| Trigger | Element | Animation | Duration |
|---------|---------|-----------|----------|
| Page enter | Entire desktop layout | `opacity: 0→1, y: 20→0` | 400ms ease-out |
| Drop zone idle | Border + icon | Gentle pulse `scale: 1↔1.01` | 2s infinite |
| Drag enter | Drop zone | `scale: 1.02`, border solidify, glow | 200ms spring |
| Image added to grid | Card | `opacity: 0→1, y: 20→0, scale: 0.95→1` | 300ms, stagger 30ms |
| Scan starts on card | Overlay gradient | Sweep top→bottom | 1.5s infinite |
| Scan complete (healthy) | Card border | Green glow pulse (1 cycle) | 600ms |
| Scan complete (diseased) | Card border | Red/amber glow + shake(2px) | 500ms |
| Panel open (right) | Inspector panel | `x: 380→0, opacity: 0→1` | 300ms spring |
| Panel close | Inspector panel | `x: 0→380, opacity: 1→0` | 200ms ease-in |
| Heatmap toggle | Canvas overlay | `opacity: 0↔0.7` | 200ms |
| Comparison slider | Divider line | `drag="x"` with momentum | physics-based |
| Stats update | Number counter | `AnimatePresence` + count-up | 400ms |
| Filter applied | Grid items | `layoutId` auto-animate reflow | 300ms spring |
| Batch complete | Summary banner | Slide from top `y: -80→0` | 500ms spring |

---

## 7. Bulk Export Features

### 7.1 Batch PDF Report

- **Trigger:** "Export All" button in top bar
- **Engine:** jsPDF (client-side only)
- **Contents per image:**
  - Thumbnail (compressed JPEG, 200×200)
  - Disease name + confidence
  - Severity level
  - Top 3 treatment recommendations
- **Summary page:** Batch statistics, disease distribution chart (canvas-rendered), field GPS coordinates if available
- **File size estimate:** ~50KB per image entry → 100 images ≈ 5MB PDF
- **Generation:** Runs in a dedicated Web Worker to prevent UI freeze

### 7.2 CSV/JSON Export

- One-click download of all scan results as `.csv` or `.json`
- Columns: filename, timestamp, disease, confidence, severity, gps_lat, gps_lng, treatments
- For integration with GIS tools (QGIS, ArcGIS) or farm management systems

### 7.3 Heatmap Gallery Export

- Export all annotated images (with bounding boxes + heatmap overlay) as a ZIP
- Uses JSZip (client-side) to bundle canvas-rendered images
- Useful for agronomist review or research documentation

---

## 8. Keyboard Shortcuts (Desktop Mode)

| Shortcut | Action |
|----------|--------|
| `Space` | Start/pause batch scan |
| `Ctrl+O` | Open file dialog |
| `Ctrl+Shift+O` | Open folder dialog |
| `H` | Toggle heatmap overlay |
| `B` | Toggle bounding boxes |
| `1-5` | Filter by severity level |
| `←` / `→` | Navigate between images |
| `Ctrl+E` | Export selected as PDF |
| `Ctrl+Shift+E` | Export all as batch PDF |
| `Ctrl+,` | Open settings |
| `Esc` | Close inspector panel / exit comparison |
| `F` | Toggle fullscreen on selected image |
| `Delete` | Remove selected from batch |

---

## 9. Responsive Degradation

| Feature | Desktop (≥1280) | Tablet (768-1279) | Mobile (<768) |
|---------|-----------------|-------------------|---------------|
| 3-column layout | ✓ | 2-column (no sidebar) | Single column |
| Drag-and-drop | Full folder support | File drop only | File picker only |
| Worker pool | Up to 6 workers | Up to 3 workers | 1 worker (main thread fallback) |
| Heatmap zoom | 8x with minimap | 4x, no minimap | 2x pinch-zoom |
| Comparison view | Side-by-side + overlay | Overlay only | Swipe toggle |
| Batch size | 500 images | 100 images | 10 images |
| Keyboard shortcuts | Full set | Partial | None |
| Status bar | Full metrics | Compact | Hidden |

---

## 10. Performance Budgets (Desktop Mode)

| Metric | Target | Measurement |
|--------|--------|-------------|
| First image result | < 2s | From drop to first prediction |
| Throughput (4 workers) | > 3 images/sec | Sustained over 100 images |
| UI frame rate during scan | ≥ 30fps | No jank during grid updates |
| Peak RAM (100 images) | < 2GB | Including ONNX sessions + image buffers |
| Grid render (100 cards) | < 100ms | Virtual scroll if > 200 items |
| Heatmap generation | < 500ms | Per image, from feature maps |
| Batch PDF (100 images) | < 30s | In background worker |
| Time to interactive | < 3s | Desktop Premium layout fully loaded |

---

## 11. File Manifest — New Components Required

```
src/
├── components/
│   └── desktop/
│       ├── BulkDropZone.tsx          # Drag-and-drop with folder support
│       ├── BulkImageGrid.tsx         # Virtualized grid with status overlays
│       ├── ImageCard.tsx             # Individual card with scan state machine
│       ├── ComparisonPanel.tsx       # Side-by-side / overlay / slider modes
│       ├── ZoomHeatmap.tsx           # Canvas zoom with CAM overlay
│       ├── BatchSidebar.tsx          # Queue + stats + filters
│       ├── DesktopStatusBar.tsx      # Worker pool & performance metrics
│       ├── DesktopTopBar.tsx         # Navigation + batch actions
│       ├── BatchSummaryBanner.tsx    # Completion notification
│       └── ContextMenu.tsx           # Right-click menu for image cards
├── lib/
│   └── workers/
│       ├── pool-manager.ts           # Worker lifecycle & queue management
│       ├── inference-worker.ts       # ONNX inference in Web Worker
│       ├── preprocess-worker.ts      # Image preprocessing in Web Worker
│       └── pdf-worker.ts             # Batch PDF generation in Web Worker
├── hooks/
│   ├── useBulkScan.ts               # Orchestrates bulk scan lifecycle
│   ├── useWorkerPool.ts             # React hook for worker pool state
│   ├── useHeatmap.ts                # CAM generation & canvas rendering
│   ├── useImageZoom.ts              # Zoom/pan state & mouse handlers
│   ├── useKeyboardShortcuts.ts      # Desktop keyboard shortcut handler
│   └── useBatchExport.ts            # PDF/CSV/ZIP export orchestration
├── app/
│   └── desktop/
│       ├── page.tsx                  # Desktop Premium entry point
│       └── layout.tsx                # Desktop-specific layout (no BottomNav)
└── styles/
    └── glassmorphism.css             # Glass panel utility classes
```

---

## 12. Zero-Cost Compliance Checklist

- [x] All inference runs in Web Workers via ONNX Runtime Web (WASM/WebGL backend)
- [x] No image data leaves the browser — ever
- [x] No server-side endpoints called during bulk scan
- [x] PDF generation is 100% client-side (jsPDF in Web Worker)
- [x] Heatmaps computed from local ONNX model activations, not cloud API
- [x] ZIP export uses JSZip (client-side)
- [x] Worker pool scales to device capability, not server resources
- [x] Supabase sync (if enabled) only sends metadata (~2KB/scan), never images
- [x] Models cached in browser Cache API after first load — subsequent scans are fully offline
