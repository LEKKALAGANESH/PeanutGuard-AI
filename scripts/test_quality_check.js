#!/usr/bin/env node
/**
 * Direct test of the checkImageQuality() function from quality-check.ts
 * against every image in the "testing images" folder.
 *
 * Shows the full QualityCheckResult (including user-facing error messages),
 * augmentation previews, and a per-image verdict table.
 *
 * Usage: node scripts/test_quality_check.js
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const IMAGES_DIR = path.resolve(__dirname, '..', '..', 'testing images');
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp']);

// ---------------------------------------------------------------------------
// Re-implement quality-check.ts logic exactly (pure JS mirror)
// ---------------------------------------------------------------------------

const BLUR_THRESHOLD = 100;
const BRIGHTNESS_TOO_DARK = 40;
const BRIGHTNESS_TOO_BRIGHT = 240;
const LEAF_COVERAGE_THRESHOLD = 0.30;
const GREEN_HUE_MIN = 25;
const GREEN_HUE_MAX = 95;
const GREEN_SAT_MIN = 0.15;
const GREEN_VAL_MIN = 0.20;

function meanBrightness(data, width, height) {
  const totalPixels = width * height;
  let sum = 0;
  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    sum += data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
  }
  return sum / totalPixels;
}

function toGrayscale(data, width, height) {
  const totalPixels = width * height;
  const gray = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    gray[i] = Math.round(data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114);
  }
  return gray;
}

function laplacianVariance(gray, width, height) {
  const innerPixels = (width - 2) * (height - 2);
  if (innerPixels <= 0) return 0;
  let sum = 0, sumSq = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const lap = gray[idx - width] + gray[idx - 1] + -4 * gray[idx] + gray[idx + 1] + gray[idx + width];
      sum += lap;
      sumSq += lap * lap;
    }
  }
  const mean = sum / innerPixels;
  return sumSq / innerPixels - mean * mean;
}

function estimateLeafCoverage(data, width, height) {
  const totalPixels = width * height;
  let greenCount = 0;
  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    const r = data[offset] / 255, g = data[offset + 1] / 255, b = data[offset + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    if (max < GREEN_VAL_MIN) continue;
    const sat = max === 0 ? 0 : delta / max;
    if (sat < GREEN_SAT_MIN) continue;
    if (delta === 0) continue;
    let hue;
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
    if (hue < 0) hue += 360;
    if (hue >= GREEN_HUE_MIN && hue <= GREEN_HUE_MAX) greenCount++;
  }
  return greenCount / totalPixels;
}

function checkImageQuality(data, width, height) {
  const issues = [];
  const suggestions = [];

  const brightness = meanBrightness(data, width, height);
  const gray = toGrayscale(data, width, height);
  const blurScore = laplacianVariance(gray, width, height);
  const leafCoverage = estimateLeafCoverage(data, width, height);

  if (blurScore < BLUR_THRESHOLD) {
    issues.push('Image is too blurry for a 10/10 result. Please stabilize your camera and re-capture.');
    suggestions.push(
      blurScore < BLUR_THRESHOLD / 2
        ? 'Severe blur detected — brace your elbows against your body, tap to focus on the leaf, and hold still for 1 second before capturing.'
        : 'Slight blur detected — tap to focus on the leaf and hold steady while the shutter fires.'
    );
  }

  if (brightness < BRIGHTNESS_TOO_DARK) {
    issues.push('Lighting too low. Please ensure the peanut leaf is in natural daylight.');
    suggestions.push("Move to an open area with indirect sunlight, or enable your phone's flash. Avoid heavy shade.");
  } else if (brightness > BRIGHTNESS_TOO_BRIGHT) {
    issues.push('Lighting too high. The image is overexposed — details are washed out.');
    suggestions.push("Shield the leaf from direct sunlight with your body's shadow, or angle your phone to reduce glare.");
  }

  if (leafCoverage < LEAF_COVERAGE_THRESHOLD) {
    issues.push(
      `Move closer! We need a detailed view of the leaf patterns. (Leaf coverage: ${(leafCoverage * 100).toFixed(0)}%, minimum: ${(LEAF_COVERAGE_THRESHOLD * 100).toFixed(0)}%)`
    );
    suggestions.push('Hold your phone 10–20 cm (4–8 inches) from the leaf so it fills most of the frame. Center any visible spots or discoloration.');
  }

  return { passed: issues.length === 0, blurScore, brightness, leafCoverage, issues, suggestions };
}

// ---------------------------------------------------------------------------
// Augmentation functions (mirror from image-augmentation.ts)
// ---------------------------------------------------------------------------

function mirrorHorizontal(data, width, height) {
  const output = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = (y * width + (width - 1 - x)) * 4;
      output[dst] = data[src]; output[dst+1] = data[src+1]; output[dst+2] = data[src+2]; output[dst+3] = data[src+3];
    }
  }
  return output;
}

function adjustContrast(data, width, height, factor) {
  const output = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    output[i]   = Math.min(255, Math.max(0, Math.round(factor * (data[i] - 128) + 128)));
    output[i+1] = Math.min(255, Math.max(0, Math.round(factor * (data[i+1] - 128) + 128)));
    output[i+2] = Math.min(255, Math.max(0, Math.round(factor * (data[i+2] - 128) + 128)));
    output[i+3] = data[i+3];
  }
  return output;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const sep = '═'.repeat(72);
  const thin = '─'.repeat(72);

  console.log(sep);
  console.log('  PEANUTGUARD — checkImageQuality() FULL TEST');
  console.log(`  Testing against: ${IMAGES_DIR}`);
  console.log(`  Date: ${new Date().toISOString()}`);
  console.log(sep);

  const files = fs.readdirSync(IMAGES_DIR).filter(f => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()));
  console.log(`\n  Found ${files.length} images\n`);

  const results = [];

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(IMAGES_DIR, filename);

    console.log(thin);
    console.log(`  IMAGE ${i + 1}/${files.length}: ${filename}`);
    console.log(thin);

    const img = await loadImage(filePath);
    const canvas = createCanvas(224, 224);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 224, 224);
    const imageData = ctx.getImageData(0, 0, 224, 224);

    // --- Run checkImageQuality ---
    const result = checkImageQuality(imageData.data, 224, 224);

    const verdict = result.passed ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`  Verdict:       ${verdict}`);
    console.log(`  Original size: ${img.width}x${img.height}`);
    console.log(`  Blur Score:    ${result.blurScore.toFixed(1)} ${result.blurScore < BLUR_THRESHOLD ? '← BELOW THRESHOLD (100)' : '✓'}`);
    console.log(`  Brightness:    ${result.brightness.toFixed(1)} ${result.brightness < 40 ? '← TOO DARK' : result.brightness > 240 ? '← TOO BRIGHT' : '✓'}`);
    console.log(`  Leaf Coverage: ${(result.leafCoverage * 100).toFixed(1)}% ${result.leafCoverage < 0.30 ? '← BELOW 30%' : '✓'}`);

    if (result.issues.length > 0) {
      console.log(`\n  USER-FACING ERRORS:`);
      result.issues.forEach((issue, idx) => {
        console.log(`    ${idx + 1}. ${issue}`);
      });
    }

    if (result.suggestions.length > 0) {
      console.log(`\n  USER-FACING SUGGESTIONS:`);
      result.suggestions.forEach((sug, idx) => {
        console.log(`    ${idx + 1}. ${sug}`);
      });
    }

    // --- Test augmentations on this image ---
    console.log(`\n  AUGMENTATION QUALITY IMPACT:`);

    // Mirror
    const mirroredData = mirrorHorizontal(imageData.data, 224, 224);
    const mirrorResult = checkImageQuality(mirroredData, 224, 224);
    console.log(`    Mirror H:     blur=${mirrorResult.blurScore.toFixed(0)}  bright=${mirrorResult.brightness.toFixed(0)}  leaf=${(mirrorResult.leafCoverage * 100).toFixed(0)}%  ${mirrorResult.passed ? '✓' : 'FAIL'}`);

    // Contrast 1.3x
    const contrastData = adjustContrast(imageData.data, 224, 224, 1.3);
    const contrastResult = checkImageQuality(contrastData, 224, 224);
    console.log(`    Contrast 1.3: blur=${contrastResult.blurScore.toFixed(0)}  bright=${contrastResult.brightness.toFixed(0)}  leaf=${(contrastResult.leafCoverage * 100).toFixed(0)}%  ${contrastResult.passed ? '✓' : 'FAIL'}`);

    // Contrast 1.5x (aggressive)
    const contrast15Data = adjustContrast(imageData.data, 224, 224, 1.5);
    const contrast15Result = checkImageQuality(contrast15Data, 224, 224);
    console.log(`    Contrast 1.5: blur=${contrast15Result.blurScore.toFixed(0)}  bright=${contrast15Result.brightness.toFixed(0)}  leaf=${(contrast15Result.leafCoverage * 100).toFixed(0)}%  ${contrast15Result.passed ? '✓' : 'FAIL'}`);

    console.log('');

    results.push({
      filename,
      originalSize: `${img.width}x${img.height}`,
      passed: result.passed,
      blurScore: result.blurScore,
      brightness: result.brightness,
      leafCoverage: result.leafCoverage,
      issueCount: result.issues.length,
      issueTypes: result.issues.length === 0 ? 'none' :
        (result.blurScore < 100 ? 'BLUR ' : '') +
        (result.brightness < 40 ? 'DARK ' : '') +
        (result.brightness > 240 ? 'BRIGHT ' : '') +
        (result.leafCoverage < 0.30 ? 'LOW_COV' : ''),
    });
  }

  // --- Summary table ---
  console.log(sep);
  console.log('  SUMMARY TABLE');
  console.log(sep);
  console.log('');

  const hdr = '  ' + 'Filename'.padEnd(45) + 'Status'.padEnd(8) + 'Blur'.padEnd(10) + 'Bright'.padEnd(10) + 'Leaf%'.padEnd(8) + 'Issues';
  console.log(hdr);
  console.log('  ' + '─'.repeat(hdr.length - 2));

  let passCount = 0, failCount = 0;
  for (const r of results) {
    const status = r.passed ? '\x1b[32mPASS\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m  ';
    const line = '  ' +
      r.filename.padEnd(45) +
      status +
      r.blurScore.toFixed(0).padEnd(10) +
      r.brightness.toFixed(0).padEnd(10) +
      (r.leafCoverage * 100).toFixed(0).padEnd(8) +
      r.issueTypes.trim();
    console.log(line);
    if (r.passed) passCount++; else failCount++;
  }

  console.log('');
  console.log(`  Total: ${results.length}  |  Passed: ${passCount}  |  Failed: ${failCount}  |  Pass Rate: ${(passCount / results.length * 100).toFixed(0)}%`);

  // --- Threshold analysis ---
  console.log('');
  console.log(sep);
  console.log('  THRESHOLD SENSITIVITY ANALYSIS');
  console.log(sep);
  console.log('');

  for (const threshold of [0.15, 0.20, 0.25, 0.30, 0.35]) {
    const passing = results.filter(r => r.blurScore >= 100 && r.brightness >= 40 && r.brightness <= 240 && r.leafCoverage >= threshold).length;
    console.log(`  Leaf coverage threshold ${(threshold * 100).toFixed(0)}%:  ${passing}/${results.length} pass (${(passing / results.length * 100).toFixed(0)}%)`);
  }

  for (const threshold of [50, 75, 100, 150, 200]) {
    const passing = results.filter(r => r.blurScore >= threshold && r.leafCoverage >= 0.30 && r.brightness >= 40 && r.brightness <= 240).length;
    console.log(`  Blur threshold ${threshold}:           ${passing}/${results.length} pass (${(passing / results.length * 100).toFixed(0)}%)`);
  }

  console.log('');
  console.log(sep);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
