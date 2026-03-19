#!/usr/bin/env node
/**
 * PeanutGuard Batch Validation Engine v2
 *
 * Outputs 3 files:
 *   1. batch_results.csv         — Mobile: per-image quality metrics + treatment recommendations
 *   2. failure_analysis.log      — Desktop: detailed diagnostics for failed images
 *   3. batch_report.json         — Desktop: structured JSON for programmatic consumption
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const args = process.argv.slice(2);
function getArg(flag, fallback) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const IMAGES_DIR = path.resolve(getArg('--images-dir', path.join(__dirname, '..', '..', 'testing images')));
const OUTPUT_DIR = path.resolve(getArg('--output-dir', path.join(__dirname, '..', 'test_output')));
const LIBRARY_PATH = path.resolve(__dirname, '..', 'src', 'data', 'disease_library.json');
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp']);

// Load disease library for treatment recommendations
const library = JSON.parse(fs.readFileSync(LIBRARY_PATH, 'utf-8'));

// ─── Quality check (mirrors quality-check.ts with brown tissue fix) ───

function meanBrightness(data, w, h) {
  let sum = 0;
  for (let i = 0; i < w * h; i++) { const o = i * 4; sum += data[o] * 0.299 + data[o+1] * 0.587 + data[o+2] * 0.114; }
  return sum / (w * h);
}

function toGrayscale(data, w, h) {
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { const o = i * 4; gray[i] = Math.round(data[o] * 0.299 + data[o+1] * 0.587 + data[o+2] * 0.114); }
  return gray;
}

function laplacianVariance(gray, w, h) {
  const inner = (w - 2) * (h - 2);
  if (inner <= 0) return 0;
  let sum = 0, sumSq = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const lap = gray[idx - w] + gray[idx - 1] + -4 * gray[idx] + gray[idx + 1] + gray[idx + w];
      sum += lap; sumSq += lap * lap;
    }
  return sumSq / inner - (sum / inner) ** 2;
}

function estimateGreenCoverage(data, w, h) {
  let count = 0;
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const r = data[o]/255, g = data[o+1]/255, b = data[o+2]/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max-min;
    if (max < 0.20 || (max === 0 ? 0 : d/max) < 0.15 || d === 0) continue;
    let hue;
    if (max === r) hue = 60*(((g-b)/d)%6); else if (max === g) hue = 60*((b-r)/d+2); else hue = 60*((r-g)/d+4);
    if (hue < 0) hue += 360;
    if (hue >= 25 && hue <= 95) count++;
  }
  return count / (w * h);
}

function estimateBrownCoverage(data, w, h) {
  let count = 0;
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const r = data[o]/255, g = data[o+1]/255, b = data[o+2]/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max-min;
    if (max < 0.15) continue;
    const sat = max === 0 ? 0 : d/max;
    // White/pale tissue (mold, mycelium)
    if (max > 0.70 && sat < 0.15 && max < 0.95) { count++; continue; }
    if (d === 0) continue;
    let hue;
    if (max === r) hue = 60*(((g-b)/d)%6); else if (max === g) hue = 60*((b-r)/d+2); else hue = 60*((r-g)/d+4);
    if (hue < 0) hue += 360;
    // Brown/tan/earth tones
    if (hue >= 10 && hue <= 50 && sat >= 0.10 && max >= 0.20) count++;
  }
  return count / (w * h);
}

function checkQuality(data, w, h) {
  const brightness = meanBrightness(data, w, h);
  const gray = toGrayscale(data, w, h);
  const blurScore = laplacianVariance(gray, w, h);
  const greenCoverage = estimateGreenCoverage(data, w, h);
  const brownCoverage = estimateBrownCoverage(data, w, h);
  const plantTissue = Math.min(1, greenCoverage + brownCoverage);
  const issues = [];
  if (blurScore < 100) issues.push('BLUR');
  if (brightness < 40) issues.push('TOO_DARK');
  else if (brightness > 240) issues.push('TOO_BRIGHT');
  if (plantTissue < 0.30) issues.push('LOW_COVERAGE');
  return { passed: issues.length === 0, blurScore, brightness, greenCoverage, brownCoverage, plantTissue, issues };
}

function brightnessHistogram(data, w, h) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < w * h; i++) { const o = i * 4; hist[Math.round(data[o]*0.299+data[o+1]*0.587+data[o+2]*0.114)]++; }
  return hist;
}

function exposureMetrics(hist, total) {
  let dark = 0, bright = 0, cum = 0, p5 = 0, p95 = 0;
  for (let i = 0; i <= 5; i++) dark += hist[i];
  for (let i = 250; i <= 255; i++) bright += hist[i];
  for (let i = 0; i < 256; i++) { cum += hist[i]; if (cum >= total*0.05 && !p5) p5 = i; if (cum >= total*0.95 && !p95) p95 = i; }
  return { clippedDarkPct: (dark/total*100).toFixed(1), clippedBrightPct: (bright/total*100).toFixed(1), dynamicRange: p95-p5, p5, p95 };
}

// ─── Label inference from filename ───

const LABEL_MAP = {
  'aspergillus': 'aspergillus_aflatoxin', 'crown rot': 'aspergillus_aflatoxin',
  'cylindrocladium': 'collar_rot', 'cbr': 'collar_rot', 'black rot': 'collar_rot',
  'botrytis': 'white_mold', 'rhizoctonia': 'white_mold', 'sclerotinia': 'white_mold', 'limb rot': 'white_mold',
  'root-knot': 'root_knot_nematode', 'root knot': 'root_knot_nematode', 'nematode': 'root_knot_nematode',
  'tswv': 'bud_necrosis', 'spotted wilt': 'bud_necrosis', 'tomato spotted': 'bud_necrosis',
  'leaf spot': 'early_leaf_spot', 'rust': 'rust', 'rosette': 'rosette_virus',
  'mottle': 'peanut_mottle', 'wilt': 'bacterial_wilt', 'chlorosis': 'iron_chlorosis',
  'healthy': 'healthy',
};

function inferLabel(filename) {
  const base = path.basename(filename, path.extname(filename)).toLowerCase();
  for (const [kw, label] of Object.entries(LABEL_MAP)) { if (base.includes(kw)) return label; }
  return 'unknown';
}

function getDiseaseCategory(label) {
  const d = library.diseases.find(d => d.label === label);
  return d ? d.category : 'unknown';
}

function getTopTreatment(label, region) {
  const d = library.diseases.find(d => d.label === label);
  if (!d) return 'N/A';
  const org = d.treatments.organic[0];
  const chem = d.treatments.chemical.filter(c => !(c.banned_in || []).some(b => b.toLowerCase() === region.toLowerCase()))[0];
  const parts = [];
  if (org) parts.push(`[Organic] ${org.name.en}: ${org.dosage}`);
  if (chem) parts.push(`[Chemical] ${chem.name.en}: ${chem.dosage}`);
  return parts.join(' | ') || 'No treatment data';
}

// ─── Augmentation recovery attempt ───

function adjustContrast(data, w, h, factor) {
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i]   = Math.min(255, Math.max(0, Math.round(factor*(data[i]-128)+128)));
    out[i+1] = Math.min(255, Math.max(0, Math.round(factor*(data[i+1]-128)+128)));
    out[i+2] = Math.min(255, Math.max(0, Math.round(factor*(data[i+2]-128)+128)));
    out[i+3] = data[i+3];
  }
  return out;
}

function mirrorH(data, w, h) {
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = (y*w+x)*4, d = (y*w+(w-1-x))*4;
      out[d]=data[s]; out[d+1]=data[s+1]; out[d+2]=data[s+2]; out[d+3]=data[s+3];
    }
  return out;
}

// ─── Main ───

async function main() {
  console.log('═'.repeat(70));
  console.log('  PeanutGuard Batch Validation Engine v2');
  console.log('═'.repeat(70));
  console.log(`  Images: ${IMAGES_DIR}`);
  console.log(`  Output: ${OUTPUT_DIR}`);

  if (!fs.existsSync(IMAGES_DIR)) { console.error('ERROR: Images dir not found'); process.exit(1); }
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const files = fs.readdirSync(IMAGES_DIR).filter(f => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()));
  console.log(`  Found ${files.length} images\n`);

  // ─── CSV header (mobile report) ───
  const csvRows = [[
    'filename','expected_label','disease_category','quality_status','blur_score','brightness',
    'green_coverage_pct','brown_coverage_pct','plant_tissue_pct','issues',
    'augmentation_recovery','treatment_recommendation',
    'original_width','original_height','dynamic_range','clipped_dark_pct','clipped_bright_pct'
  ].join(',')];

  const failureLog = [];
  const jsonReport = { generated: new Date().toISOString(), imagesDir: IMAGES_DIR, images: [], summary: {} };
  let passCount = 0, failCount = 0, recoveredCount = 0;

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(IMAGES_DIR, filename);
    const expectedLabel = inferLabel(filename);
    const category = getDiseaseCategory(expectedLabel);

    process.stdout.write(`  [${i+1}/${files.length}] ${filename} ... `);

    const img = await loadImage(filePath);
    const canvas = createCanvas(224, 224);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 224, 224);
    const imageData = ctx.getImageData(0, 0, 224, 224);

    const quality = checkQuality(imageData.data, 224, 224);
    const hist = brightnessHistogram(imageData.data, 224, 224);
    const exposure = exposureMetrics(hist, 224 * 224);

    // ─── Augmentation recovery attempt for failed images ───
    let recoveryStatus = 'N/A';
    if (!quality.passed) {
      // Try contrast boost
      const boosted = adjustContrast(imageData.data, 224, 224, 1.3);
      const retryQ = checkQuality(boosted, 224, 224);
      if (retryQ.passed) {
        recoveryStatus = 'RECOVERED_CONTRAST_1.3x';
        recoveredCount++;
      } else {
        // Try mirror + contrast
        const mirrored = mirrorH(imageData.data, 224, 224);
        const mirrorBoosted = adjustContrast(mirrored, 224, 224, 1.5);
        const retryQ2 = checkQuality(mirrorBoosted, 224, 224);
        if (retryQ2.passed) {
          recoveryStatus = 'RECOVERED_MIRROR+CONTRAST_1.5x';
          recoveredCount++;
        } else {
          recoveryStatus = 'NOT_RECOVERABLE';
        }
      }
    }

    const finalStatus = quality.passed ? 'PASS' : (recoveryStatus.startsWith('RECOVERED') ? 'SOFT_PASS' : 'FAIL');
    if (quality.passed) passCount++; else if (recoveryStatus.startsWith('RECOVERED')) passCount++; else failCount++;

    const treatment = expectedLabel !== 'unknown' ? getTopTreatment(expectedLabel, 'IN') : 'N/A';

    console.log(
      `${finalStatus}  blur=${quality.blurScore.toFixed(0)}  bright=${quality.brightness.toFixed(0)}  ` +
      `green=${(quality.greenCoverage*100).toFixed(0)}%  brown=${(quality.brownCoverage*100).toFixed(0)}%  ` +
      `tissue=${(quality.plantTissue*100).toFixed(0)}%` +
      (quality.issues.length > 0 ? `  [${quality.issues.join(', ')}]` : '') +
      (recoveryStatus.startsWith('RECOVERED') ? `  → ${recoveryStatus}` : '')
    );

    // ─── CSV row ───
    csvRows.push([
      `"${filename}"`, expectedLabel, category, finalStatus,
      quality.blurScore.toFixed(1), quality.brightness.toFixed(1),
      (quality.greenCoverage*100).toFixed(1), (quality.brownCoverage*100).toFixed(1),
      (quality.plantTissue*100).toFixed(1),
      `"${quality.issues.join('; ')}"`,
      recoveryStatus, `"${treatment.replace(/"/g, '""')}"`,
      img.width, img.height, exposure.dynamicRange, exposure.clippedDarkPct, exposure.clippedBrightPct,
    ].join(','));

    // ─── JSON entry ───
    const jsonEntry = {
      filename, expectedLabel, category, status: finalStatus,
      quality: {
        blurScore: +quality.blurScore.toFixed(1),
        brightness: +quality.brightness.toFixed(1),
        greenCoverage: +(quality.greenCoverage*100).toFixed(1),
        brownCoverage: +(quality.brownCoverage*100).toFixed(1),
        plantTissueCoverage: +(quality.plantTissue*100).toFixed(1),
        issues: quality.issues,
      },
      augmentationRecovery: recoveryStatus,
      exposure: { dynamicRange: exposure.dynamicRange, p5: exposure.p5, p95: exposure.p95, clippedDarkPct: +exposure.clippedDarkPct, clippedBrightPct: +exposure.clippedBrightPct },
      originalSize: { width: img.width, height: img.height },
      treatment: expectedLabel !== 'unknown' ? treatment : null,
    };
    jsonReport.images.push(jsonEntry);

    // ─── Failure log entry ───
    if (finalStatus === 'FAIL') {
      const diseaseInfo = library.diseases.find(d => d.label === expectedLabel);
      const isRootDisease = ['root_knot_nematode'].includes(expectedLabel);
      const isStemDisease = ['collar_rot', 'white_mold', 'aspergillus_aflatoxin'].includes(expectedLabel);

      failureLog.push('', '─'.repeat(60));
      failureLog.push(`FILE: ${filename}`);
      failureLog.push(`EXPECTED LABEL: ${expectedLabel} (${category})`);
      failureLog.push(`DISEASE NAME: ${diseaseInfo ? diseaseInfo.name.en : 'Unknown'}`);
      failureLog.push(`STATUS: ${finalStatus}`);
      failureLog.push('─'.repeat(60));
      failureLog.push(`  Blur Score:      ${quality.blurScore.toFixed(2)} (threshold: 100)`);
      failureLog.push(`  Brightness:      ${quality.brightness.toFixed(2)} (range: 40–240)`);
      failureLog.push(`  Green Coverage:  ${(quality.greenCoverage*100).toFixed(1)}%`);
      failureLog.push(`  Brown Coverage:  ${(quality.brownCoverage*100).toFixed(1)}%`);
      failureLog.push(`  Plant Tissue:    ${(quality.plantTissue*100).toFixed(1)}% (threshold: 30%)`);
      failureLog.push(`  Dynamic Range:   ${exposure.dynamicRange} (p5=${exposure.p5}, p95=${exposure.p95})`);
      failureLog.push(`  Original Size:   ${img.width}x${img.height}`);
      failureLog.push(`  Augmentation:    ${recoveryStatus}`);
      failureLog.push(`  Issues: ${quality.issues.join(', ')}`);
      failureLog.push('');
      failureLog.push('  DIAGNOSIS:');
      if (isRootDisease) {
        failureLog.push('    This is a ROOT DISEASE image. Roots/galls are brown, not green.');
        failureLog.push('    The green coverage gate correctly detects low green, but brown tissue');
        failureLog.push('    detection should compensate. If this fails, the image may show mostly');
        failureLog.push('    soil background rather than root tissue.');
      } else if (isStemDisease) {
        failureLog.push('    This is a STEM/CROWN DISEASE image. Affected tissue is brown/white.');
        failureLog.push('    Combined green+brown detection should pass these images.');
        failureLog.push('    If still failing, the disease area may be too small in the frame.');
      } else if (quality.issues.includes('BLUR')) {
        failureLog.push('    Image is too blurry. Source image resolution is low or motion-blurred.');
      } else {
        failureLog.push('    Subject does not fill enough of the frame.');
      }
      failureLog.push('');
      failureLog.push('  RECOMMENDATIONS:');
      if (quality.issues.includes('BLUR')) failureLog.push('    * Stabilize camera; use tripod or brace elbows.');
      if (quality.issues.includes('TOO_DARK')) failureLog.push('    * Move to natural daylight or enable flash.');
      if (quality.issues.includes('TOO_BRIGHT')) failureLog.push('    * Shield from direct sun; use body shadow.');
      if (quality.issues.includes('LOW_COVERAGE')) {
        if (isRootDisease) failureLog.push('    * Hold phone directly over uprooted roots, fill frame with galled root tissue.');
        else if (isStemDisease) failureLog.push('    * Point camera at the affected stem/crown area, 10-15cm distance.');
        else failureLog.push('    * Move phone 10-20cm from the plant so tissue fills >30% of frame.');
      }
      if (treatment !== 'N/A') {
        failureLog.push('');
        failureLog.push('  TREATMENT (if this disease is confirmed):');
        failureLog.push(`    ${treatment}`);
      }
    }
  }

  // ─── Summary ───
  jsonReport.summary = {
    total: files.length, passed: passCount, failed: failCount, recovered: recoveredCount,
    passRate: `${(passCount/files.length*100).toFixed(0)}%`,
    diseaseDistribution: {},
  };
  for (const entry of jsonReport.images) {
    if (entry.expectedLabel !== 'unknown') {
      jsonReport.summary.diseaseDistribution[entry.expectedLabel] = (jsonReport.summary.diseaseDistribution[entry.expectedLabel] || 0) + 1;
    }
  }

  // ─── Write outputs ───
  // File 1: CSV (Mobile report)
  fs.writeFileSync(path.join(OUTPUT_DIR, 'batch_results.csv'), csvRows.join('\n'), 'utf-8');

  // File 2: Failure log (Desktop diagnostics)
  const logHeader = [
    '═'.repeat(60), '  PeanutGuard Failure Analysis Log v2',
    `  Generated: ${new Date().toISOString()}`, `  Images: ${IMAGES_DIR}`,
    `  Total: ${files.length} | Passed: ${passCount} | Failed: ${failCount} | Recovered: ${recoveredCount}`,
    '═'.repeat(60),
  ];
  fs.writeFileSync(path.join(OUTPUT_DIR, 'failure_analysis.log'), [...logHeader, ...failureLog].join('\n'), 'utf-8');

  // File 3: JSON (Desktop structured report)
  fs.writeFileSync(path.join(OUTPUT_DIR, 'batch_report.json'), JSON.stringify(jsonReport, null, 2), 'utf-8');

  // ─── Console summary ───
  console.log('\n' + '─'.repeat(70));
  console.log('  SUMMARY');
  console.log('─'.repeat(70));
  console.log(`  Total:     ${files.length}`);
  console.log(`  Passed:    ${passCount} (${(passCount/files.length*100).toFixed(0)}%)`);
  console.log(`  Failed:    ${failCount} (${(failCount/files.length*100).toFixed(0)}%)`);
  console.log(`  Recovered: ${recoveredCount} (via augmentation)`);
  console.log('');
  console.log(`  Output files:`);
  console.log(`    1. ${path.join(OUTPUT_DIR, 'batch_results.csv')}     (Mobile)`);
  console.log(`    2. ${path.join(OUTPUT_DIR, 'failure_analysis.log')}  (Desktop)`);
  console.log(`    3. ${path.join(OUTPUT_DIR, 'batch_report.json')}     (Desktop)`);
  console.log('─'.repeat(70));
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
