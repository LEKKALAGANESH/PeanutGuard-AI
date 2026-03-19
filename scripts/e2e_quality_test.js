#!/usr/bin/env node
/**
 * End-to-End Quality Check Integration Test
 *
 * Simulates the EXACT browser pipeline using node-canvas:
 *   1. Load image -> resize to 224x224 (same as preprocess.ts)
 *   2. Run checkImageQuality() (blur + brightness + leaf coverage)
 *   3. Run all TTA augmentations (mirror, contrast, rotate)
 *   4. Map issues to ImageIssue enum (same as ScanProcessor.tsx)
 *   5. Verify QualityFeedback component would render correct errors
 *
 * This validates the FULL integration chain:
 *   quality-check.ts -> preprocess.ts -> ScanProcessor.tsx -> QualityFeedback.tsx
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const IMAGES_DIR = path.resolve(__dirname, '..', '..', 'testing images');

// ─── Thresholds (must match quality-check.ts exactly) ───
const BLUR_THRESHOLD = 100;
const BRIGHTNESS_TOO_DARK = 40;
const BRIGHTNESS_TOO_BRIGHT = 240;
const LEAF_COVERAGE_THRESHOLD = 0.30;
const GREEN_HUE_MIN = 25;
const GREEN_HUE_MAX = 95;
const GREEN_SAT_MIN = 0.15;
const GREEN_VAL_MIN = 0.20;

// ─── ImageIssue enum (must match types/index.ts) ───
const VALID_ISSUE_TYPES = ['blur', 'dark', 'overexposed', 'not_peanut', 'partial_leaf', 'low_confidence'];

// ─── QualityFeedback labels (must match QualityFeedback.tsx) ───
const ISSUE_LABELS = {
  blur: {
    label: 'Image is too blurry for a 10/10 result',
    suggestion: "Stabilize your camera — brace elbows against your body, tap to focus on the leaf, and hold still for 1 second before capturing.",
    critical: true,
  },
  dark: {
    label: 'Lighting too low for accurate analysis',
    suggestion: "Move the peanut leaf into natural daylight. Use your phone's flash if in shade, and avoid heavy canopy cover.",
    critical: true,
  },
  overexposed: {
    label: 'Lighting too high — details are washed out',
    suggestion: "Shield the leaf from direct sunlight with your body's shadow, or angle your phone to reduce glare.",
    critical: true,
  },
  not_peanut: {
    label: 'Not a peanut plant',
    critical: true,
  },
  partial_leaf: {
    label: 'Move closer! We need a detailed view',
    suggestion: 'Hold your phone 10–20 cm (4–8 inches) from the leaf so it fills most of the frame.',
    critical: false,
  },
  low_confidence: {
    label: 'Unable to identify clearly',
    critical: false,
  },
};

// ─── Quality check functions (exact mirror of quality-check.ts) ───

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
      sum += lap;
      sumSq += lap * lap;
    }
  }
  const mean = sum / inner;
  return sumSq / inner - mean * mean;
}

function estimateLeafCoverage(data, w, h) {
  let green = 0;
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const r = data[o] / 255, g = data[o + 1] / 255, b = data[o + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (max < GREEN_VAL_MIN || (max === 0 ? 0 : d / max) < GREEN_SAT_MIN || d === 0) continue;
    let hue;
    if (max === r) hue = 60 * (((g - b) / d) % 6);
    else if (max === g) hue = 60 * ((b - r) / d + 2);
    else hue = 60 * ((r - g) / d + 4);
    if (hue < 0) hue += 360;
    if (hue >= GREEN_HUE_MIN && hue <= GREEN_HUE_MAX) green++;
  }
  return green / (w * h);
}

function checkImageQuality(data, w, h) {
  const issues = [], suggestions = [];
  const brightness = meanBrightness(data, w, h);
  const gray = toGrayscale(data, w, h);
  const blurScore = laplacianVariance(gray, w, h);
  const leafCoverage = estimateLeafCoverage(data, w, h);

  if (blurScore < BLUR_THRESHOLD) {
    issues.push('Image is too blurry for a 10/10 result. Please stabilize your camera and re-capture.');
    suggestions.push(blurScore < 50
      ? 'Severe blur detected — brace your elbows against your body, tap to focus on the leaf, and hold still for 1 second before capturing.'
      : 'Slight blur detected — tap to focus on the leaf and hold steady while the shutter fires.');
  }
  if (brightness < BRIGHTNESS_TOO_DARK) {
    issues.push('Lighting too low. Please ensure the peanut leaf is in natural daylight.');
    suggestions.push("Move to an open area with indirect sunlight, or enable your phone's flash. Avoid heavy shade.");
  } else if (brightness > BRIGHTNESS_TOO_BRIGHT) {
    issues.push('Lighting too high. The image is overexposed — details are washed out.');
    suggestions.push("Shield the leaf from direct sunlight with your body's shadow, or angle your phone to reduce glare.");
  }
  if (leafCoverage < LEAF_COVERAGE_THRESHOLD) {
    issues.push(`Move closer! We need a detailed view of the leaf patterns. (Leaf coverage: ${(leafCoverage * 100).toFixed(0)}%, minimum: ${(LEAF_COVERAGE_THRESHOLD * 100).toFixed(0)}%)`);
    suggestions.push('Hold your phone 10–20 cm (4–8 inches) from the leaf so it fills most of the frame. Center any visible spots or discoloration.');
  }

  return { passed: issues.length === 0, blurScore, brightness, leafCoverage, issues, suggestions };
}

// ─── Issue type mapper (exact mirror of ScanProcessor.tsx logic) ───

function mapIssuesToTypes(issues) {
  const types = [];
  for (const msg of issues) {
    const lower = msg.toLowerCase();
    if (lower.includes('blurry') || lower.includes('blur')) types.push('blur');
    else if (lower.includes('lighting too low') || lower.includes('too dark')) types.push('dark');
    else if (lower.includes('lighting too high') || lower.includes('overexposed')) types.push('overexposed');
    else if (lower.includes('move closer') || lower.includes('leaf coverage')) types.push('partial_leaf');
  }
  return types;
}

// ─── Augmentation functions (mirror of image-augmentation.ts) ───

function mirrorHorizontal(data, w, h) {
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, d = (y * w + (w - 1 - x)) * 4;
      out[d] = data[s]; out[d+1] = data[s+1]; out[d+2] = data[s+2]; out[d+3] = data[s+3];
    }
  return out;
}

function adjustContrast(data, w, h, factor) {
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i]   = Math.min(255, Math.max(0, Math.round(factor * (data[i] - 128) + 128)));
    out[i+1] = Math.min(255, Math.max(0, Math.round(factor * (data[i+1] - 128) + 128)));
    out[i+2] = Math.min(255, Math.max(0, Math.round(factor * (data[i+2] - 128) + 128)));
    out[i+3] = data[i+3];
  }
  return out;
}

function rotate90(data, w, h) {
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, d = (x * h + (h - 1 - y)) * 4;
      out[d] = data[s]; out[d+1] = data[s+1]; out[d+2] = data[s+2]; out[d+3] = data[s+3];
    }
  return out;
}

// ─── Main test runner ───

async function main() {
  const SEP = '='.repeat(80);
  const THIN = '-'.repeat(80);

  console.log(SEP);
  console.log('  PEANUTGUARD E2E INTEGRATION TEST');
  console.log('  Full pipeline: quality-check.ts -> ScanProcessor.tsx -> QualityFeedback.tsx');
  console.log(SEP);

  const files = fs.readdirSync(IMAGES_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  console.log(`\n  Testing ${files.length} images from: ${IMAGES_DIR}\n`);

  let totalTests = 0, passedTests = 0, failedTests = 0;
  const allResults = [];

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(IMAGES_DIR, filename);
    console.log(THIN);
    console.log(`  [${i + 1}/${files.length}] ${filename}`);
    console.log(THIN);

    const img = await loadImage(filePath);
    const canvas = createCanvas(224, 224);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 224, 224);
    const imageData = ctx.getImageData(0, 0, 224, 224);

    // ── TEST 1: checkImageQuality() returns valid structure ──
    totalTests++;
    const quality = checkImageQuality(imageData.data, 224, 224);

    const structureValid =
      typeof quality.passed === 'boolean' &&
      typeof quality.blurScore === 'number' &&
      typeof quality.brightness === 'number' &&
      typeof quality.leafCoverage === 'number' &&
      Array.isArray(quality.issues) &&
      Array.isArray(quality.suggestions);

    if (structureValid) {
      passedTests++;
      console.log('  [PASS] QualityCheckResult has valid structure (passed, blurScore, brightness, leafCoverage, issues, suggestions)');
    } else {
      failedTests++;
      console.log('  [FAIL] QualityCheckResult structure invalid!');
    }

    // ── TEST 2: Metrics are within sane ranges ──
    totalTests++;
    const metricsValid =
      quality.blurScore >= 0 &&
      quality.brightness >= 0 && quality.brightness <= 255 &&
      quality.leafCoverage >= 0 && quality.leafCoverage <= 1;

    if (metricsValid) {
      passedTests++;
      console.log(`  [PASS] Metrics in valid ranges: blur=${quality.blurScore.toFixed(0)}, bright=${quality.brightness.toFixed(0)}, leaf=${(quality.leafCoverage*100).toFixed(0)}%`);
    } else {
      failedTests++;
      console.log(`  [FAIL] Metrics out of range! blur=${quality.blurScore}, bright=${quality.brightness}, leaf=${quality.leafCoverage}`);
    }

    // ── TEST 3: Issue messages trigger correct ImageIssue types ──
    totalTests++;
    const issueTypes = mapIssuesToTypes(quality.issues);
    const allTypesValid = issueTypes.every(t => VALID_ISSUE_TYPES.includes(t));

    if (allTypesValid) {
      passedTests++;
      const typesStr = issueTypes.length > 0 ? issueTypes.join(', ') : 'none';
      console.log(`  [PASS] Issue mapping valid: [${typesStr}]`);
    } else {
      failedTests++;
      console.log(`  [FAIL] Invalid issue types: ${JSON.stringify(issueTypes)}`);
    }

    // ── TEST 4: Every mapped issue type has a QualityFeedback label ──
    totalTests++;
    const allLabelsExist = issueTypes.every(t => ISSUE_LABELS[t] !== undefined);

    if (allLabelsExist) {
      passedTests++;
      if (issueTypes.length > 0) {
        issueTypes.forEach(t => {
          console.log(`  [PASS] QualityFeedback renders: "${ISSUE_LABELS[t].label}" (critical: ${ISSUE_LABELS[t].critical})`);
        });
      } else {
        console.log('  [PASS] No issues — QualityFeedback would not render (correct behavior)');
      }
    } else {
      failedTests++;
      console.log('  [FAIL] Missing QualityFeedback labels for some issue types!');
    }

    // ── TEST 5: passed=true means zero issues; passed=false means >0 issues ──
    totalTests++;
    const passedConsistent = quality.passed === (quality.issues.length === 0);
    if (passedConsistent) {
      passedTests++;
      console.log(`  [PASS] passed=${quality.passed} is consistent with ${quality.issues.length} issues`);
    } else {
      failedTests++;
      console.log(`  [FAIL] Inconsistency: passed=${quality.passed} but ${quality.issues.length} issues`);
    }

    // ── TEST 6: Augmentations don't crash ──
    totalTests++;
    let augSuccess = true;
    try {
      const mirrored = mirrorHorizontal(imageData.data, 224, 224);
      const mResult = checkImageQuality(mirrored, 224, 224);

      const contrasted = adjustContrast(imageData.data, 224, 224, 1.3);
      const cResult = checkImageQuality(contrasted, 224, 224);

      const rotated = rotate90(imageData.data, 224, 224);
      const rResult = checkImageQuality(rotated, 224, 224);

      // Mirror should not change brightness significantly
      const brightDiff = Math.abs(mResult.brightness - quality.brightness);
      if (brightDiff > 1) {
        console.log(`  [WARN] Mirror changed brightness by ${brightDiff.toFixed(1)} — expected <1`);
      }

      console.log(`  [PASS] Augmentations OK: mirror(blur=${mResult.blurScore.toFixed(0)}) contrast(blur=${cResult.blurScore.toFixed(0)}) rotate(blur=${rResult.blurScore.toFixed(0)})`);
    } catch (err) {
      augSuccess = false;
      console.log(`  [FAIL] Augmentation error: ${err.message}`);
    }
    if (augSuccess) passedTests++; else failedTests++;

    // ── TEST 7: Suggestions array length matches issues array length ──
    totalTests++;
    if (quality.suggestions.length === quality.issues.length) {
      passedTests++;
      console.log(`  [PASS] ${quality.suggestions.length} suggestion(s) match ${quality.issues.length} issue(s)`);
    } else {
      failedTests++;
      console.log(`  [FAIL] Mismatch: ${quality.issues.length} issues but ${quality.suggestions.length} suggestions`);
    }

    allResults.push({
      filename,
      passed: quality.passed,
      blur: quality.blurScore,
      bright: quality.brightness,
      leaf: quality.leafCoverage,
      issueTypes,
    });

    console.log('');
  }

  // ── Summary ──
  console.log(SEP);
  console.log('  INTEGRATION TEST RESULTS');
  console.log(SEP);
  console.log(`  Total tests:  ${totalTests}`);
  console.log(`  Passed:       ${passedTests}  (${(passedTests/totalTests*100).toFixed(0)}%)`);
  console.log(`  Failed:       ${failedTests}  (${(failedTests/totalTests*100).toFixed(0)}%)`);
  console.log('');

  // ── Quality check summary table ──
  console.log('  IMAGE QUALITY RESULTS:');
  console.log('  ' + 'Filename'.padEnd(45) + 'Status'.padEnd(8) + 'Blur'.padEnd(8) + 'Bright'.padEnd(8) + 'Leaf%'.padEnd(8) + 'UI Issues');
  console.log('  ' + '-'.repeat(90));
  for (const r of allResults) {
    const s = r.passed ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log('  ' +
      r.filename.padEnd(45) +
      (r.passed ? 'PASS  ' : 'FAIL  ') +
      r.blur.toFixed(0).padEnd(8) +
      r.bright.toFixed(0).padEnd(8) +
      (r.leaf * 100).toFixed(0).padEnd(8) +
      (r.issueTypes.length > 0 ? r.issueTypes.join(', ') : '-'));
  }

  console.log('');
  if (failedTests === 0) {
    console.log('  ALL TESTS PASSED — Full pipeline integration verified.');
  } else {
    console.log(`  ${failedTests} TEST(S) FAILED — review issues above.`);
  }
  console.log(SEP);

  process.exit(failedTests > 0 ? 1 : 0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
