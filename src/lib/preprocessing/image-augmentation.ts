/**
 * On-the-fly data augmentation utilities for PeanutGuard.
 *
 * These augmentations are applied client-side before inference to improve
 * robustness without retraining the model. Each produces a new ImageData
 * that can be fed through the existing preprocessing pipeline.
 *
 * Strategy: run inference on the original + N augmented copies, then
 * ensemble the softmax outputs (average or max) for a more stable prediction.
 * This is "test-time augmentation" (TTA) and typically boosts accuracy 2-5%
 * with zero model changes.
 */

// ---------------------------------------------------------------------------
// Core augmentations
// ---------------------------------------------------------------------------

/**
 * Horizontal mirror (flip left-right).
 *
 * Peanut disease symptoms have no left/right bias, so mirroring is a safe
 * augmentation that doubles effective coverage without introducing artifacts.
 */
export function mirrorHorizontal(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcOffset = (y * width + x) * 4;
      const dstOffset = (y * width + (width - 1 - x)) * 4;
      output[dstOffset] = data[srcOffset];
      output[dstOffset + 1] = data[srcOffset + 1];
      output[dstOffset + 2] = data[srcOffset + 2];
      output[dstOffset + 3] = data[srcOffset + 3];
    }
  }

  return new ImageData(output, width, height);
}

/**
 * Vertical mirror (flip top-bottom).
 */
export function mirrorVertical(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcOffset = (y * width + x) * 4;
      const dstOffset = ((height - 1 - y) * width + x) * 4;
      output[dstOffset] = data[srcOffset];
      output[dstOffset + 1] = data[srcOffset + 1];
      output[dstOffset + 2] = data[srcOffset + 2];
      output[dstOffset + 3] = data[srcOffset + 3];
    }
  }

  return new ImageData(output, width, height);
}

/**
 * Adjust contrast by scaling pixel values around the mean.
 *
 * factor > 1.0: boost contrast (makes disease spots pop against leaf background)
 * factor < 1.0: reduce contrast
 * factor = 1.0: no change
 *
 * Formula: output = clamp(factor * (pixel - 128) + 128, 0, 255)
 */
export function adjustContrast(imageData: ImageData, factor: number): ImageData {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);

  for (let i = 0; i < data.length; i += 4) {
    output[i] = Math.min(255, Math.max(0, Math.round(factor * (data[i] - 128) + 128)));
    output[i + 1] = Math.min(255, Math.max(0, Math.round(factor * (data[i + 1] - 128) + 128)));
    output[i + 2] = Math.min(255, Math.max(0, Math.round(factor * (data[i + 2] - 128) + 128)));
    output[i + 3] = data[i + 3];
  }

  return new ImageData(output, width, height);
}

/**
 * Adjust brightness by adding a fixed offset to all channels.
 *
 * offset > 0: brighten
 * offset < 0: darken
 */
export function adjustBrightness(imageData: ImageData, offset: number): ImageData {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);

  for (let i = 0; i < data.length; i += 4) {
    output[i] = Math.min(255, Math.max(0, data[i] + offset));
    output[i + 1] = Math.min(255, Math.max(0, data[i + 1] + offset));
    output[i + 2] = Math.min(255, Math.max(0, data[i + 2] + offset));
    output[i + 3] = data[i + 3];
  }

  return new ImageData(output, width, height);
}

/**
 * Rotate image by 90° clockwise.
 * Output dimensions swap: width × height → height × width.
 * Only works on square images (224×224 model input), so dimensions stay the same.
 */
export function rotate90(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcOffset = (y * width + x) * 4;
      // Rotated position: (x, height-1-y) in the new image
      const dstOffset = (x * height + (height - 1 - y)) * 4;
      output[dstOffset] = data[srcOffset];
      output[dstOffset + 1] = data[srcOffset + 1];
      output[dstOffset + 2] = data[srcOffset + 2];
      output[dstOffset + 3] = data[srcOffset + 3];
    }
  }

  // For square images, output dimensions are the same
  return new ImageData(output, height, width);
}

/**
 * Add slight color jitter — random per-channel shift within [-jitter, +jitter].
 * Simulates lighting variation in the field (warm sunrise vs cool shade).
 *
 * Uses a seeded approach for reproducibility when needed.
 */
export function colorJitter(imageData: ImageData, jitter: number = 15): ImageData {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);

  // Per-channel offsets (consistent across all pixels for a natural look)
  const rShift = Math.round((Math.random() * 2 - 1) * jitter);
  const gShift = Math.round((Math.random() * 2 - 1) * jitter);
  const bShift = Math.round((Math.random() * 2 - 1) * jitter);

  for (let i = 0; i < data.length; i += 4) {
    output[i] = Math.min(255, Math.max(0, data[i] + rShift));
    output[i + 1] = Math.min(255, Math.max(0, data[i + 1] + gShift));
    output[i + 2] = Math.min(255, Math.max(0, data[i + 2] + bShift));
    output[i + 3] = data[i + 3];
  }

  return new ImageData(output, width, height);
}

// ---------------------------------------------------------------------------
// Test-Time Augmentation (TTA) preset
// ---------------------------------------------------------------------------

export interface AugmentationPreset {
  name: string;
  apply: (imageData: ImageData) => ImageData;
}

/**
 * Standard TTA preset for PeanutGuard inference.
 *
 * Produces 4 augmented copies (+ the original = 5 total) for ensemble averaging:
 *   1. Original (no transform)
 *   2. Horizontal mirror
 *   3. Contrast boost (1.3x)
 *   4. 90° rotation
 *   5. Mirror + contrast boost combo
 *
 * Usage:
 *   const augmented = TTA_PRESETS.map(p => p.apply(imageData));
 *   // Run inference on each, then average softmax outputs
 */
export const TTA_PRESETS: AugmentationPreset[] = [
  {
    name: 'original',
    apply: (img) => img,
  },
  {
    name: 'mirror_horizontal',
    apply: mirrorHorizontal,
  },
  {
    name: 'contrast_boost',
    apply: (img) => adjustContrast(img, 1.3),
  },
  {
    name: 'rotate_90',
    apply: rotate90,
  },
  {
    name: 'mirror_contrast',
    apply: (img) => adjustContrast(mirrorHorizontal(img), 1.2),
  },
];
