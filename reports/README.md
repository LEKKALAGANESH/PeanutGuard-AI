# PeanutGuard AI — Project Reports

**Last Updated:** 2026-03-19
**Build:** PASS | **TypeScript:** 0 errors | **Tests:** 581/581 PASS | **Batch:** 16/17 (94%)

---

## Folder Structure

```
reports/
├── README.md                  ← This file (master index)
├── strategy/                  ← Project planning & architecture
│   ├── PeanutGuard_Execution_Strategy.md   Master strategy (10 sections)
│   ├── architecture_flow.md                Tech stack, system diagram, DB schema
│   ├── farmer_needs_analysis.md            User personas, feature specs, market gaps
│   ├── sprint_backlog_v1.md                4-week scrum plan, risk mitigations
│   └── final_project_checklist.md          90-file audit, completion tracking
├── specs/                     ← Feature specifications
│   ├── desktop_premium_ui_spec.md          Desktop drag-drop bulk scan UI spec
│   ├── api_route_map.md                    All routes, data flows, service worker
│   ├── peanut_disease_library.md           18 diseases, visual patterns, treatments
│   └── expert_validation_protocol.md       3-tier expert review flow
└── test-output/               ← Latest test run results
    ├── test_run_summary.md                 Full project status report
    ├── batch_results.csv                   Per-image quality + treatment (Mobile)
    ├── batch_report.json                   Structured results (Desktop)
    └── failure_analysis.log                Failed image diagnostics
```

---

## Quick Status

### Implemented (73 source files, 6,600+ LOC)

| Category      | Count | Key Files                                                                                                                                 |
| ------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Pages         | 7     | Home, Scan, Result, History, Fields, Test-Quality, Harvest\*                                                                              |
| Components    | 22    | CameraCapture, ScanProcessor, QualityFeedback, ResultCard, TreatmentAccordion, ExportButton, VoiceQueryButton + 10 Desktop components     |
| AI Pipeline   | 4     | model-loader, inference (3-stage), labels (19-class), index (convenience API)                                                             |
| Preprocessing | 6     | quality-check (blur+brightness+tissue), CLAHE, EXIF, augmentation (TTA), preprocess                                                       |
| Database      | 5     | Dexie schema, scan/field/harvest/batch repositories                                                                                       |
| Treatments    | 1     | Region-aware engine with confusion pairs, urgency, rescan intervals                                                                       |
| Workers       | 2     | inference-worker, worker-pool (parallel batch)                                                                                            |
| Hooks         | 10    | useCamera, useScan, useHistory, useBulkScan, useWorkerPool, useHeatmap, useImageZoom, useKeyboardShortcuts, useBatchExport, useMediaQuery |
| Stores        | 4     | scan-store, user-store, bulk-scan-store, desktop-ui-store                                                                                 |

### Pending (Phase 4 — Post-MVP)

| Item                          | Blocker                          |
| ----------------------------- | -------------------------------- |
| ONNX model training (4 files) | Need ICRISAT/Pak-Nuts dataset    |
| Expert review UI + backend    | Supabase Edge Function needed    |
| i18n (Hindi, Telugu locales)  | Human translation needed         |
| Harvest page UI               | Repository ready, page not built |
| Custom service worker         | next-pwa handles basics          |

---

## Key Metrics

| Metric                 | Value                                                           |
| ---------------------- | --------------------------------------------------------------- |
| Disease classes        | 19 (healthy + 18 diseases)                                      |
| Treatments per disease | 2 organic + 2 chemical + 2 cultural (avg)                       |
| Regions supported      | India, Nigeria, USA (+ EU ban filtering)                        |
| Quality gate pass rate | 94% on test set (was 59% before brown tissue fix)               |
| Responsive breakpoints | 4 (phone, sm tablet, md tablet, desktop)                        |
| Keyboard shortcuts     | 16 (Space, H, B, Ctrl+O/E, arrows, 1-5, F, Esc, Ctrl+,)         |
| Voice commands         | 6 actions (treatment, severity, harvest, explain, impact, help) |
| TTA augmentations      | 5 presets (mirror, contrast, rotate, mirror+contrast, original) |
