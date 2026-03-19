export interface QualityCheckResult {
  passed: boolean;
  blurScore: number;
  brightness: number;
  leafCoverage: number;
  plantTissueCoverage: number;
  issues: string[];
  suggestions: string[];
}

// ---------------------------------------------------------------------------
// Thresholds — calibrated for typical smartphone cameras (8-48MP, f/1.7-2.4)
// ---------------------------------------------------------------------------

/**
 * Laplacian variance threshold for blur detection.
 *
 * Empirical calibration for smartphone cameras:
 *   - Sharp handheld photo:    500 – 3000+
 *   - Acceptable focus:        100 – 500
 *   - Slightly soft / motion:   50 – 100
 *   - Clearly blurry:           < 50
 *
 * We use 100 as the cut-off — this rejects motion blur and severe defocus
 * while tolerating minor softness from cheap lenses or digital zoom.
 * The 3x3 Laplacian kernel is resolution-independent on the 224x224 resized
 * input, so the threshold stays stable across phone models.
 */
const BLUR_THRESHOLD = 100;

const BRIGHTNESS_TOO_DARK = 40;
const BRIGHTNESS_TOO_BRIGHT = 240;

/**
 * Minimum fraction of the frame that must contain green (plant) pixels.
 * 30% ensures the leaf fills enough of the image for accurate classification.
 * Below this, fine disease textures (e.g. rust pustules, lesion margins) are
 * lost in the resize to 224x224.
 */
const LEAF_COVERAGE_THRESHOLD = 0.30;

/**
 * HSV-space thresholds for "green vegetation" detection.
 * Tuned for peanut leaves under varied field lighting conditions:
 *   - Hue: 25°–95° (covers yellow-green to blue-green; peanut leaves trend
 *     toward warm green / yellow-green, especially when stressed)
 *   - Saturation: >= 15% (filters out gray/white/brown backgrounds)
 *   - Value: >= 20% (filters out deep shadows)
 */
const GREEN_HUE_MIN = 25;
const GREEN_HUE_MAX = 95;
const GREEN_SAT_MIN = 0.15;
const GREEN_VAL_MIN = 0.20;

// ---------------------------------------------------------------------------
// Pixel-level helpers
// ---------------------------------------------------------------------------

/**
 * Compute mean brightness using luminance formula.
 * Y = R*0.299 + G*0.587 + B*0.114
 */
function meanBrightness(data: Uint8ClampedArray, width: number, height: number): number {
  const totalPixels = width * height;
  let sum = 0;

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    sum += data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
  }

  return sum / totalPixels;
}

/**
 * Compute brightness histogram (256 bins).
 * Used for exposure quality metrics beyond simple mean.
 */
export function brightnessHistogram(data: Uint8ClampedArray, width: number, height: number): Uint32Array {
  const histogram = new Uint32Array(256);
  const totalPixels = width * height;

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    const lum = Math.round(data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114);
    histogram[lum]++;
  }

  return histogram;
}

/**
 * Convert RGBA pixel data to grayscale Uint8 array (single channel).
 */
function toGrayscale(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const totalPixels = width * height;
  const gray = new Uint8Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    gray[i] = Math.round(
      data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114
    );
  }

  return gray;
}

/**
 * Compute Laplacian variance as a blur metric.
 * Higher variance = sharper image. Lower = blurrier.
 *
 * Laplacian kernel (3x3):
 *   [0,  1, 0]
 *   [1, -4, 1]
 *   [0,  1, 0]
 *
 * The variance of the Laplacian response captures edge density — sharp images
 * have strong, high-variance edges while blurry images have low, uniform
 * responses. This is the "Pech-Pacheco 2000" method, widely validated for
 * autofocus and quality assessment.
 */
function laplacianVariance(gray: Uint8Array, width: number, height: number): number {
  const innerPixels = (width - 2) * (height - 2);
  if (innerPixels <= 0) {
    return 0;
  }

  let sum = 0;
  let sumSq = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;

      const laplacian =
        gray[idx - width] +       // top
        gray[idx - 1] +           // left
        -4 * gray[idx] +          // center
        gray[idx + 1] +           // right
        gray[idx + width];        // bottom

      sum += laplacian;
      sumSq += laplacian * laplacian;
    }
  }

  const mean = sum / innerPixels;
  const variance = sumSq / innerPixels - mean * mean;

  return variance;
}

/**
 * Estimate leaf coverage as the fraction of green-vegetation pixels.
 *
 * Uses HSV color-space thresholding to detect green plant matter:
 *   1. Convert each RGBA pixel to HSV
 *   2. Check if Hue is in the green range (25°–95°)
 *   3. Check Saturation >= 15% and Value >= 20%
 *   4. Return greenPixels / totalPixels
 *
 * This is a proxy for "distance/scale" — if the leaf fills <30% of the frame,
 * the user is too far away or the subject is off-center.
 */
function estimateLeafCoverage(data: Uint8ClampedArray, width: number, height: number): number {
  const totalPixels = width * height;
  let greenCount = 0;

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    const r = data[offset] / 255;
    const g = data[offset + 1] / 255;
    const b = data[offset + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    // Value check (brightness)
    if (max < GREEN_VAL_MIN) continue;

    // Saturation check
    const saturation = max === 0 ? 0 : delta / max;
    if (saturation < GREEN_SAT_MIN) continue;

    // Hue calculation (0–360°)
    let hue: number;
    if (delta === 0) {
      continue; // achromatic — not green
    } else if (max === r) {
      hue = 60 * (((g - b) / delta) % 6);
    } else if (max === g) {
      hue = 60 * ((b - r) / delta + 2);
    } else {
      hue = 60 * ((r - g) / delta + 4);
    }
    if (hue < 0) hue += 360;

    // Green vegetation hue range
    if (hue >= GREEN_HUE_MIN && hue <= GREEN_HUE_MAX) {
      greenCount++;
    }
  }

  return greenCount / totalPixels;
}

/**
 * Estimate brown/earth-tone plant tissue coverage.
 *
 * Detects roots, stems, crowns, and diseased tissue that is NOT green:
 *   - Brown range: Hue 10°–40°, moderate saturation/value (soil, roots, stems)
 *   - Tan/beige range: Hue 25°–50°, low saturation (dry tissue, mold surfaces)
 *   - White mold: Low saturation, high value (Sclerotinia, Botrytis mycelium)
 *
 * This ensures non-leaf disease images (root-knot nematode, collar rot,
 * aspergillus crown rot, white mold on stems) are not rejected by the
 * green-only leaf coverage gate.
 */
function estimateBrownTissueCoverage(data: Uint8ClampedArray, width: number, height: number): number {
  const totalPixels = width * height;
  let brownCount = 0;

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    const r = data[offset] / 255;
    const g = data[offset + 1] / 255;
    const b = data[offset + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    if (max < 0.15) continue; // too dark (shadow, not tissue)

    const saturation = max === 0 ? 0 : delta / max;

    // White/pale tissue detection (mold, mycelium): high value, very low saturation
    if (max > 0.70 && saturation < 0.15 && max < 0.95) {
      brownCount++;
      continue;
    }

    if (delta === 0) continue;

    let hue: number;
    if (max === r) {
      hue = 60 * (((g - b) / delta) % 6);
    } else if (max === g) {
      hue = 60 * ((b - r) / delta + 2);
    } else {
      hue = 60 * ((r - g) / delta + 4);
    }
    if (hue < 0) hue += 360;

    // Brown/tan/earth tones: Hue 10°–50°, moderate saturation
    if (hue >= 10 && hue <= 50 && saturation >= 0.10 && max >= 0.20) {
      brownCount++;
    }
  }

  return brownCount / totalPixels;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Full image quality audit — the "Smart Gatekeeper" that runs before inference.
 *
 * Checks three quality dimensions:
 *   1. **Sharpness** — Laplacian variance (rejects motion blur / defocus)
 *   2. **Exposure** — Mean luminance (rejects under/over-exposed shots)
 *   3. **Scale/Distance** — Green vegetation coverage (rejects distant / off-target shots)
 *
 * Returns pass/fail with user-friendly, actionable error messages designed
 * for farmers in the field — clear language, specific remediation steps.
 */
export function checkImageQuality(imageData: ImageData): QualityCheckResult {
  const { data, width, height } = imageData;
  const issues: string[] = [];
  const suggestions: string[] = [];

  // 1. Brightness / Exposure
  const brightness = meanBrightness(data, width, height);

  // 2. Sharpness / Blur
  const gray = toGrayscale(data, width, height);
  const blurScore = laplacianVariance(gray, width, height);

  // 3. Plant tissue coverage (green leaves + brown roots/stems/crowns)
  const leafCoverage = estimateLeafCoverage(data, width, height);
  const brownCoverage = estimateBrownTissueCoverage(data, width, height);
  const plantTissueCoverage = Math.min(1, leafCoverage + brownCoverage);

  // --- Evaluate blur ---
  if (blurScore < BLUR_THRESHOLD) {
    issues.push(
      'Image is too blurry for a 10/10 result. Please stabilize your camera and re-capture.'
    );
    suggestions.push(
      blurScore < BLUR_THRESHOLD / 2
        ? 'Severe blur detected — brace your elbows against your body, tap to focus on the leaf, and hold still for 1 second before capturing.'
        : 'Slight blur detected — tap to focus on the leaf and hold steady while the shutter fires.'
    );
  }

  // --- Evaluate exposure ---
  if (brightness < BRIGHTNESS_TOO_DARK) {
    issues.push(
      'Lighting too low. Please ensure the peanut leaf is in natural daylight.'
    );
    suggestions.push(
      'Move to an open area with indirect sunlight, or enable your phone\'s flash. Avoid heavy shade.'
    );
  } else if (brightness > BRIGHTNESS_TOO_BRIGHT) {
    issues.push(
      'Lighting too high. The image is overexposed — details are washed out.'
    );
    suggestions.push(
      'Shield the leaf from direct sunlight with your body\'s shadow, or angle your phone to reduce glare.'
    );
  }

  // --- Evaluate distance / scale ---
  // Use COMBINED plant tissue coverage (green leaves + brown roots/stems/crowns)
  // This ensures root-knot nematode, collar rot, aspergillus crown rot,
  // and white mold on stems are NOT rejected by the green-only gate.
  if (plantTissueCoverage < LEAF_COVERAGE_THRESHOLD) {
    issues.push(
      `Move closer! We need a detailed view of the crop. (Plant tissue: ${(plantTissueCoverage * 100).toFixed(0)}%, minimum: ${(LEAF_COVERAGE_THRESHOLD * 100).toFixed(0)}%)`
    );
    suggestions.push(
      leafCoverage < 0.10 && brownCoverage < 0.10
        ? 'The image may not contain peanut plant tissue. Point your camera at leaves, stems, roots, or pods.'
        : 'Hold your phone 10–20 cm (4–8 inches) from the plant so it fills most of the frame. Center any visible spots or discoloration.'
    );
  }

  const passed = issues.length === 0;

  return {
    passed,
    blurScore,
    brightness,
    leafCoverage,
    plantTissueCoverage,
    issues,
    suggestions,
  };
}
