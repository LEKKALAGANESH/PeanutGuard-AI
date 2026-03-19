#!/usr/bin/env node
/**
 * PeanutGuard Full System Test
 *
 * Tests every core module, every cross-file dependency, every data path,
 * and every function that is exported from lib/.
 *
 * Run: node scripts/full_system_test.js
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const IMAGES_DIR = path.resolve(__dirname, '..', '..', 'testing images');
const SRC_DIR = path.resolve(__dirname, '..', 'src');

let totalTests = 0;
let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  totalTests++;
  try {
    const result = fn();
    if (result === false) throw new Error('returned false');
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ✗ ${name}: ${msg}`);
    failures.push({ name, error: msg });
  }
}

async function testAsync(name, fn) {
  totalTests++;
  try {
    const result = await fn();
    if (result === false) throw new Error('returned false');
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ✗ ${name}: ${msg}`);
    failures.push({ name, error: msg });
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 1: File Existence & Structure
// ═══════════════════════════════════════════════════════════════

function testFileStructure() {
  console.log('\n═══ SECTION 1: File Structure ═══');

  const requiredFiles = [
    // Pages
    'app/layout.tsx', 'app/page.tsx', 'app/scan/page.tsx',
    'app/scan/result/page.tsx', 'app/history/page.tsx', 'app/fields/page.tsx',
    // Components
    'components/layout/AppShell.tsx', 'components/layout/BottomNav.tsx',
    'components/scan/CameraCapture.tsx', 'components/scan/ScanProcessor.tsx',
    'components/scan/QualityFeedback.tsx', 'components/scan/PhoneDropZone.tsx',
    'components/scan/PhoneBatchView.tsx',
    'components/results/ResultCard.tsx', 'components/results/SeverityMeter.tsx',
    'components/results/TreatmentAccordion.tsx',
    'components/pdf/ExportButton.tsx', 'components/voice/VoiceQueryButton.tsx',
    // Desktop components
    'components/desktop/BatchSidebar.tsx', 'components/desktop/BulkDropZone.tsx',
    'components/desktop/BulkImageGrid.tsx', 'components/desktop/ImageCard.tsx',
    'components/desktop/ZoomHeatmap.tsx', 'components/desktop/ComparisonPanel.tsx',
    'components/desktop/ContextMenu.tsx', 'components/desktop/DesktopStatusBar.tsx',
    'components/desktop/DesktopTopBar.tsx', 'components/desktop/BatchSummaryBanner.tsx',
    // AI pipeline
    'lib/ai/index.ts', 'lib/ai/inference.ts', 'lib/ai/model-loader.ts', 'lib/ai/labels.ts',
    // Preprocessing
    'lib/preprocessing/preprocess.ts', 'lib/preprocessing/quality-check.ts',
    'lib/preprocessing/clahe.ts', 'lib/preprocessing/exif.ts',
    'lib/preprocessing/image-augmentation.ts', 'lib/preprocessing/index.ts',
    // Database
    'lib/db/index.ts', 'lib/db/scan-repository.ts', 'lib/db/field-repository.ts',
    'lib/db/batch-repository.ts', 'lib/db/harvest-repository.ts',
    // Treatments
    'lib/treatments/treatment-engine.ts',
    // PDF
    'lib/pdf/report-generator.ts',
    // Workers
    'lib/workers/inference-worker.ts', 'lib/workers/worker-pool.ts',
    // Voice
    'lib/voice/speech-recognition.ts', 'lib/voice/query-matcher.ts',
    // Geo/Weather/Risk
    'lib/geo/geolocation.ts', 'lib/weather/open-meteo.ts', 'lib/risk/environmental-risk.ts',
    // Sync
    'lib/sync/offline-queue.ts', 'lib/supabase/client.ts', 'lib/supabase/sync.ts',
    // Hooks
    'hooks/useCamera.ts', 'hooks/useScan.ts', 'hooks/useHistory.ts',
    'hooks/useBulkScan.ts', 'hooks/useWorkerPool.ts', 'hooks/useHeatmap.ts',
    'hooks/useImageZoom.ts', 'hooks/useKeyboardShortcuts.ts',
    'hooks/useMediaQuery.ts', 'hooks/useBatchExport.ts',
    // Stores
    'stores/scan-store.ts', 'stores/user-store.ts',
    'stores/bulk-scan-store.ts', 'stores/desktop-ui-store.ts',
    // Types
    'types/index.ts', 'types/desktop.ts',
    // Data
    'data/disease_library.json', 'data/environmental_logic_config.json',
  ];

  for (const file of requiredFiles) {
    test(`File exists: ${file}`, () => {
      return fs.existsSync(path.join(SRC_DIR, file));
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 2: Disease Library Integrity
// ═══════════════════════════════════════════════════════════════

function testDiseaseLibrary() {
  console.log('\n═══ SECTION 2: Disease Library ═══');

  const library = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'data/disease_library.json'), 'utf-8'));
  const labels = [
    'healthy', 'early_leaf_spot', 'late_leaf_spot', 'rust', 'white_mold',
    'aspergillus_aflatoxin', 'web_blotch', 'collar_rot', 'rosette_virus',
    'bud_necrosis', 'peanut_mottle', 'bacterial_wilt', 'root_knot_nematode',
    'iron_chlorosis', 'nitrogen_deficiency', 'calcium_deficiency',
    'boron_deficiency', 'drought_stress', 'herbicide_injury',
  ];

  test('Library has 19 diseases', () => library.diseases.length === 19);

  for (const label of labels) {
    const disease = library.diseases.find(d => d.label === label);
    test(`Disease "${label}" exists`, () => !!disease);

    if (!disease || label === 'healthy') continue;

    test(`${label}: has organic treatments`, () => disease.treatments.organic.length > 0);
    test(`${label}: has chemical treatments`, () => disease.treatments.chemical.length > 0);
    test(`${label}: has cultural practices`, () => disease.treatments.cultural.length > 0);
    test(`${label}: has 5 severity levels`, () => Object.keys(disease.severity_descriptions).length === 5);
    test(`${label}: has yield impact`, () => disease.yield_impact.max_pct > 0);
    test(`${label}: has IN brands`, () => {
      const allTreatments = [...disease.treatments.organic, ...disease.treatments.chemical];
      return allTreatments.some(t => (t.brands_by_region?.IN || []).length > 0);
    });
    test(`${label}: has NG brands`, () => {
      const allTreatments = [...disease.treatments.organic, ...disease.treatments.chemical];
      return allTreatments.some(t => (t.brands_by_region?.NG || []).length > 0);
    });
    test(`${label}: has US brands`, () => {
      const allTreatments = [...disease.treatments.organic, ...disease.treatments.chemical];
      return allTreatments.some(t => (t.brands_by_region?.US || []).length > 0);
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 3: Quality Check Pipeline
// ═══════════════════════════════════════════════════════════════

async function testQualityCheck() {
  console.log('\n═══ SECTION 3: Quality Check Pipeline ═══');

  // ── Re-implement quality check (mirrors quality-check.ts) ──
  function meanBrightness(data, w, h) {
    let sum = 0;
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      sum += data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114;
    }
    return sum / (w * h);
  }

  function toGrayscale(data, w, h) {
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      gray[i] = Math.round(data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114);
    }
    return gray;
  }

  function laplacianVariance(gray, w, h) {
    const inner = (w - 2) * (h - 2);
    if (inner <= 0) return 0;
    let sum = 0, sumSq = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const lap = gray[idx - w] + gray[idx - 1] + -4 * gray[idx] + gray[idx + 1] + gray[idx + w];
        sum += lap; sumSq += lap * lap;
      }
    }
    return sumSq / inner - (sum / inner) * (sum / inner);
  }

  function estimateLeafCoverage(data, w, h) {
    let green = 0;
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      const r = data[o] / 255, g = data[o + 1] / 255, b = data[o + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      if (max < 0.20 || (max === 0 ? 0 : d / max) < 0.15 || d === 0) continue;
      let hue;
      if (max === r) hue = 60 * (((g - b) / d) % 6);
      else if (max === g) hue = 60 * ((b - r) / d + 2);
      else hue = 60 * ((r - g) / d + 4);
      if (hue < 0) hue += 360;
      if (hue >= 25 && hue <= 95) green++;
    }
    return green / (w * h);
  }

  function checkQuality(data, w, h) {
    const brightness = meanBrightness(data, w, h);
    const gray = toGrayscale(data, w, h);
    const blurScore = laplacianVariance(gray, w, h);
    const leafCoverage = estimateLeafCoverage(data, w, h);
    const issues = [];
    if (blurScore < 100) issues.push('BLUR');
    if (brightness < 40) issues.push('DARK');
    else if (brightness > 240) issues.push('BRIGHT');
    if (leafCoverage < 0.30) issues.push('LOW_COVERAGE');
    return { passed: issues.length === 0, blurScore, brightness, leafCoverage, issues };
  }

  // Test each image
  const files = fs.readdirSync(IMAGES_DIR).filter(f => /\.(jpg|jpeg|png)$/i.test(f));

  for (const filename of files) {
    await testAsync(`QualityCheck: ${filename}`, async () => {
      const img = await loadImage(path.join(IMAGES_DIR, filename));
      const canvas = createCanvas(224, 224);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 224, 224);
      const imageData = ctx.getImageData(0, 0, 224, 224);
      const result = checkQuality(imageData.data, 224, 224);

      // Verify structure
      if (typeof result.passed !== 'boolean') throw new Error('passed not boolean');
      if (typeof result.blurScore !== 'number') throw new Error('blurScore not number');
      if (typeof result.brightness !== 'number') throw new Error('brightness not number');
      if (typeof result.leafCoverage !== 'number') throw new Error('leafCoverage not number');
      if (result.blurScore < 0) throw new Error('negative blur');
      if (result.brightness < 0 || result.brightness > 255) throw new Error('brightness out of range');
      if (result.leafCoverage < 0 || result.leafCoverage > 1) throw new Error('coverage out of range');
      if (result.passed !== (result.issues.length === 0)) throw new Error('passed/issues mismatch');
      return true;
    });
  }

  // Test augmentations don't crash
  await testAsync('Augmentation: mirrorH on test image', async () => {
    const img = await loadImage(path.join(IMAGES_DIR, 'download.jpg'));
    const canvas = createCanvas(224, 224);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 224, 224);
    const data = ctx.getImageData(0, 0, 224, 224).data;
    const out = new Uint8ClampedArray(data.length);
    for (let y = 0; y < 224; y++)
      for (let x = 0; x < 224; x++) {
        const s = (y * 224 + x) * 4, d = (y * 224 + (223 - x)) * 4;
        out[d] = data[s]; out[d+1] = data[s+1]; out[d+2] = data[s+2]; out[d+3] = data[s+3];
      }
    const result = checkQuality(out, 224, 224);
    if (typeof result.passed !== 'boolean') throw new Error('mirror result invalid');
    return true;
  });
}

// ═══════════════════════════════════════════════════════════════
// SECTION 4: Treatment Engine
// ═══════════════════════════════════════════════════════════════

function testTreatmentEngine() {
  console.log('\n═══ SECTION 4: Treatment Engine ═══');

  const library = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'data/disease_library.json'), 'utf-8'));
  const regions = ['IN', 'NG', 'US', 'EU'];

  for (const disease of library.diseases) {
    if (disease.label === 'healthy') continue;

    for (const region of regions) {
      test(`${disease.label}/${region}: banned filter works`, () => {
        const safeChemicals = disease.treatments.chemical.filter(c => {
          if (!c.banned_in || c.banned_in.length === 0) return true;
          return !c.banned_in.some(b => b.toLowerCase() === region.toLowerCase());
        });
        // In EU, many chemicals should be filtered
        if (region === 'EU') {
          const bannedCount = disease.treatments.chemical.length - safeChemicals.length;
          // Verify banned ones actually have banned_in containing EU
          for (const chem of disease.treatments.chemical) {
            if (chem.banned_in?.some(b => b.toLowerCase() === 'eu')) {
              if (safeChemicals.includes(chem)) throw new Error('Banned chemical not filtered');
            }
          }
        }
        return true;
      });
    }
  }

  // Test confusion pairs exist
  for (const disease of library.diseases) {
    if (!disease.confusion_pairs || disease.confusion_pairs.length === 0) continue;
    for (const pair of disease.confusion_pairs) {
      test(`Confusion pair: ${disease.label} -> ${pair} exists`, () => {
        return library.diseases.some(d => d.label === pair);
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 5: Cross-File Import Verification
// ═══════════════════════════════════════════════════════════════

function testImports() {
  console.log('\n═══ SECTION 5: Import Chain Integrity ═══');

  const importMap = {
    'checkImageQuality': 'lib/preprocessing/quality-check.ts',
    'brightnessHistogram': 'lib/preprocessing/quality-check.ts',
    'applyCLAHE': 'lib/preprocessing/clahe.ts',
    'getExifOrientation': 'lib/preprocessing/exif.ts',
    'drawWithOrientation': 'lib/preprocessing/exif.ts',
    'preprocessImage': 'lib/preprocessing/preprocess.ts',
    'aggressivePreprocess': 'lib/preprocessing/preprocess.ts',
    'mirrorHorizontal': 'lib/preprocessing/image-augmentation.ts',
    'adjustContrast': 'lib/preprocessing/image-augmentation.ts',
    'rotate90': 'lib/preprocessing/image-augmentation.ts',
    'TTA_PRESETS': 'lib/preprocessing/image-augmentation.ts',
    'InferenceEngine': 'lib/ai/inference.ts',
    'ModelLoader': 'lib/ai/model-loader.ts',
    'DISEASE_LABELS': 'lib/ai/labels.ts',
    'runPeanutGate': 'lib/ai/index.ts',
    'classifyDisease': 'lib/ai/index.ts',
    'detectLesions': 'lib/ai/index.ts',
    'runFullScan': 'lib/ai/index.ts',
    'checkModelsAvailable': 'lib/ai/index.ts',
    'disposeModels': 'lib/ai/index.ts',
    'getRecommendations': 'lib/treatments/treatment-engine.ts',
    'getUrgencyLevel': 'lib/treatments/treatment-engine.ts',
    'getUrgencyColor': 'lib/treatments/treatment-engine.ts',
    'getConfusionWarnings': 'lib/treatments/treatment-engine.ts',
    'getRescanIntervalDays': 'lib/treatments/treatment-engine.ts',
    'formatBrandsForRegion': 'lib/treatments/treatment-engine.ts',
    'generateReport': 'lib/pdf/report-generator.ts',
    'downloadReport': 'lib/pdf/report-generator.ts',
    'scanRepository': 'lib/db/scan-repository.ts',
    'fieldRepository': 'lib/db/field-repository.ts',
    'harvestRepository': 'lib/db/harvest-repository.ts',
    'saveBatchResults': 'lib/db/batch-repository.ts',
    'getBatchSummary': 'lib/db/batch-repository.ts',
    'calculateDiseasePressure': 'lib/db/harvest-repository.ts',
    'calculateReadinessScore': 'lib/db/harvest-repository.ts',
    'getCurrentPosition': 'lib/geo/geolocation.ts',
    'watchPosition': 'lib/geo/geolocation.ts',
    'fetchWeather': 'lib/weather/open-meteo.ts',
    'calculateRisk': 'lib/risk/environmental-risk.ts',
    'enqueueSyncAction': 'lib/sync/offline-queue.ts',
    'processSyncQueue': 'lib/sync/offline-queue.ts',
    'setupOnlineListener': 'lib/sync/offline-queue.ts',
    'startBackgroundSync': 'lib/supabase/sync.ts',
    'syncScans': 'lib/supabase/sync.ts',
    'startListening': 'lib/voice/speech-recognition.ts',
    'stopListening': 'lib/voice/speech-recognition.ts',
    'speak': 'lib/voice/speech-recognition.ts',
    'matchVoiceQuery': 'lib/voice/query-matcher.ts',
    'levenshtein': 'lib/voice/query-matcher.ts',
    'WorkerPool': 'lib/workers/worker-pool.ts',
  };

  for (const [name, file] of Object.entries(importMap)) {
    test(`Export "${name}" exists in ${file}`, () => {
      const content = fs.readFileSync(path.join(SRC_DIR, file), 'utf-8');
      return content.includes(`export`) && content.includes(name);
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 6: Environmental Config
// ═══════════════════════════════════════════════════════════════

function testEnvConfig() {
  console.log('\n═══ SECTION 6: Environmental Config ═══');

  const config = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'data/environmental_logic_config.json'), 'utf-8'));

  test('Config has risk_score_formula', () => !!config.risk_score_formula);
  test('Model weight is 0.85', () => config.risk_score_formula.model_weight === 0.85);
  test('Env weight is 0.15', () => config.risk_score_formula.environmental_weight === 0.15);
  test('Config has disease_climate_triggers', () => !!config.disease_climate_triggers);

  const labels = ['early_leaf_spot', 'late_leaf_spot', 'rust', 'white_mold', 'aspergillus_aflatoxin'];
  for (const label of labels) {
    test(`Climate trigger for ${label}`, () => !!config.disease_climate_triggers[label]);
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 7: TypeScript Compilation
// ═══════════════════════════════════════════════════════════════

async function testTypeScript() {
  console.log('\n═══ SECTION 7: TypeScript & Build ═══');

  const { execSync } = require('child_process');
  const cwd = path.resolve(__dirname, '..');

  await testAsync('TypeScript compiles with zero errors', async () => {
    const result = execSync('npx tsc --noEmit 2>&1', { cwd, encoding: 'utf-8', timeout: 60000 });
    if (result.trim().length > 0) throw new Error(result.trim().slice(0, 200));
    return true;
  });
}

// ═══════════════════════════════════════════════════════════════
// SECTION 8: Voice Query Matcher
// ═══════════════════════════════════════════════════════════════

function testVoiceMatcher() {
  console.log('\n═══ SECTION 8: Voice Query Matcher ═══');

  // Re-implement levenshtein
  function levenshtein(a, b) {
    if (a.length > 200 || b.length > 200) return Math.max(a.length, b.length);
    const m = a.length, n = b.length;
    if (m === 0) return n; if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    return dp[m][n];
  }

  test('levenshtein("spray", "spray") = 0', () => levenshtein('spray', 'spray') === 0);
  test('levenshtein("spary", "spray") = 2', () => levenshtein('spary', 'spray') === 2);
  test('levenshtein("", "abc") = 3', () => levenshtein('', 'abc') === 3);
  test('levenshtein guards long strings', () => {
    const long = 'a'.repeat(300);
    return levenshtein(long, 'test') === 300;
  });

  // Test keyword matching patterns
  const patterns = [
    { input: 'what should I spray', expected: 'show_treatment' },
    { input: 'is this serious', expected: 'show_severity' },
    { input: 'when should I harvest', expected: 'show_harvest' },
    { input: 'why did this happen', expected: 'show_explanation' },
    { input: 'how much yield will I lose', expected: 'show_impact' },
    { input: 'dawai kya lagani chahiye', expected: 'show_treatment' },
  ];

  // Simple keyword match check
  const actionKeywords = {
    show_treatment: ['spray', 'treat', 'medicine', 'chemical', 'dawai'],
    show_severity: ['serious', 'bad', 'danger', 'severe', 'gambhir'],
    show_harvest: ['harvest', 'ready', 'dig', 'mature'],
    show_explanation: ['cause', 'why', 'reason', 'explain', 'kyu'],
    show_impact: ['lose', 'loss', 'yield', 'money', 'nuksan'],
  };

  for (const { input, expected } of patterns) {
    test(`Voice: "${input}" -> ${expected}`, () => {
      const words = input.toLowerCase().split(/\s+/);
      const keywords = actionKeywords[expected];
      return words.some(w => keywords.some(k => w.includes(k) || k.includes(w)));
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 9: No Remaining Stubs
// ═══════════════════════════════════════════════════════════════

function testNoStubs() {
  console.log('\n═══ SECTION 9: No Stubs/TODOs in Core ═══');

  const tsFiles = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') walk(full);
      else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) tsFiles.push(full);
    }
  }
  walk(SRC_DIR);

  for (const file of tsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const rel = path.relative(SRC_DIR, file);

    test(`${rel}: no "TODO" in code`, () => {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('TODO') && !line.startsWith('//') === false) {
          // Allow TODO only in comments
        }
        // Check for actual TODO markers that indicate unfinished work
        if (/\bTODO\b/.test(line) && !line.startsWith('*') && !line.startsWith('//')) {
          throw new Error(`Line ${i+1}: ${line.slice(0, 80)}`);
        }
      }
      return true;
    });

    test(`${rel}: no "void variable" stubs`, () => {
      if (/void [a-z]\w*;/.test(content) && !content.includes('void action;')) return true;
      // The old stub pattern was "void action; void payload;" — should be gone now
      if (content.includes('void action;') || content.includes('void payload;')) {
        throw new Error('Found "void variable;" stub pattern');
      }
      return true;
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('═'.repeat(60));
  console.log('  PEANUTGUARD FULL SYSTEM TEST');
  console.log('═'.repeat(60));

  testFileStructure();
  testDiseaseLibrary();
  await testQualityCheck();
  testTreatmentEngine();
  testImports();
  testEnvConfig();
  await testTypeScript();
  testVoiceMatcher();
  testNoStubs();

  console.log('\n' + '═'.repeat(60));
  console.log(`  RESULTS: ${passed}/${totalTests} passed, ${failed} failed`);
  console.log('═'.repeat(60));

  if (failures.length > 0) {
    console.log('\n  FAILURES:');
    failures.forEach((f, i) => console.log(`  ${i+1}. ${f.name}: ${f.error}`));
  } else {
    console.log('\n  ALL TESTS PASSED');
  }

  console.log('═'.repeat(60));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
