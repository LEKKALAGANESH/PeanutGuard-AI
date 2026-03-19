import { checkImageQuality, type QualityCheckResult } from '@/lib/preprocessing/quality-check';
import { applyCLAHE } from '@/lib/preprocessing/clahe';
import { getExifOrientation, drawWithOrientation } from '@/lib/preprocessing/exif';

/** Target model input dimensions. */
const TARGET_SIZE = 224;

/** ImageNet channel means for normalization. */
const IMAGENET_MEAN: [number, number, number] = [0.485, 0.456, 0.406];

/** ImageNet channel standard deviations for normalization. */
const IMAGENET_STD: [number, number, number] = [0.229, 0.224, 0.225];

/** Brightness thresholds for applying CLAHE. */
const CLAHE_DARK_LOW = 40;
const CLAHE_DARK_HIGH = 80;
const CLAHE_BRIGHT_LOW = 200;
const CLAHE_BRIGHT_HIGH = 240;

export interface PreprocessResult {
  /** Float32Array tensor in [1, 3, 224, 224] NCHW layout, ImageNet-normalized. */
  tensor: Float32Array;
  /** Base64 data URL of the resized (and possibly enhanced) image for UI display. */
  thumbnail: string;
  /** Image quality assessment report. */
  qualityReport: QualityCheckResult;
}

/**
 * Create a canvas element — prefers OffscreenCanvas when available,
 * falls back to document.createElement('canvas') for environments
 * without OffscreenCanvas support.
 */
function createCanvas(
  width: number,
  height: number
): { canvas: OffscreenCanvas | HTMLCanvasElement; ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D } {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get OffscreenCanvas 2D context');
    }
    return { canvas, ctx };
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get Canvas 2D context');
    }
    return { canvas, ctx };
  }

  throw new Error('No canvas implementation available (neither OffscreenCanvas nor DOM)');
}

/**
 * Convert canvas to a base64 data URL.
 */
async function canvasToDataURL(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<string> {
  if (canvas instanceof OffscreenCanvas) {
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('FileReader did not produce a string result'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
      reader.readAsDataURL(blob);
    });
  }

  // HTMLCanvasElement
  return canvas.toDataURL('image/jpeg', 0.8);
}

/**
 * Convert ImageData pixels to an NCHW Float32Array tensor with ImageNet normalization.
 *
 * Layout: [1, 3, 224, 224]
 *   - Plane 0 (R): indices [0 .. 224*224-1]
 *   - Plane 1 (G): indices [224*224 .. 2*224*224-1]
 *   - Plane 2 (B): indices [2*224*224 .. 3*224*224-1]
 *
 * Normalization: (pixel / 255 - mean) / std
 */
function imageDataToNCHWTensor(imageData: ImageData): Float32Array {
  const { data, width, height } = imageData;
  const channelSize = width * height;
  const tensor = new Float32Array(1 * 3 * channelSize);

  for (let i = 0; i < channelSize; i++) {
    const srcOffset = i * 4;

    // R channel
    tensor[i] = (data[srcOffset] / 255 - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
    // G channel
    tensor[channelSize + i] = (data[srcOffset + 1] / 255 - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
    // B channel
    tensor[2 * channelSize + i] = (data[srcOffset + 2] / 255 - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
  }

  return tensor;
}

/**
 * Apply gamma correction to ImageData.
 * pixel_out = 255 * (pixel_in / 255) ^ gamma
 */
function applyGamma(imageData: ImageData, gamma: number): ImageData {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);
  const invGamma = 1.0 / gamma;

  // Precompute lookup table for speed
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.min(255, Math.max(0, Math.round(255 * Math.pow(i / 255, invGamma))));
  }

  for (let i = 0; i < data.length; i += 4) {
    output[i] = lut[data[i]];
    output[i + 1] = lut[data[i + 1]];
    output[i + 2] = lut[data[i + 2]];
    output[i + 3] = data[i + 3]; // preserve alpha
  }

  return new ImageData(output, width, height);
}

/**
 * Apply a 3x3 Gaussian blur to ImageData.
 * Kernel (normalized):
 *   [1/16, 2/16, 1/16]
 *   [2/16, 4/16, 2/16]
 *   [1/16, 2/16, 1/16]
 */
function gaussianBlur3x3(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);

  // Copy alpha and handle borders by replicating source
  for (let i = 3; i < data.length; i += 4) {
    output[i] = data[i];
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            // Clamp to image boundaries
            const sy = Math.min(height - 1, Math.max(0, y + ky));
            const sx = Math.min(width - 1, Math.max(0, x + kx));
            const idx = (sy * width + sx) * 4 + c;

            // Gaussian kernel weights
            const absKy = Math.abs(ky);
            const absKx = Math.abs(kx);
            let weight: number;
            if (absKy === 0 && absKx === 0) {
              weight = 4;
            } else if (absKy + absKx === 1) {
              weight = 2;
            } else {
              weight = 1;
            }

            sum += data[idx] * weight;
          }
        }

        const outIdx = (y * width + x) * 4 + c;
        output[outIdx] = Math.round(sum / 16);
      }
    }
  }

  return new ImageData(output, width, height);
}

/**
 * Apply unsharp mask sharpening.
 * sharp = original + alpha * (original - blurred)
 */
function unsharpMask(imageData: ImageData, alpha: number = 0.5): ImageData {
  const blurred = gaussianBlur3x3(imageData);
  const { data, width, height } = imageData;
  const blurData = blurred.data;
  const output = new Uint8ClampedArray(data.length);

  for (let i = 0; i < data.length; i += 4) {
    output[i] = Math.min(255, Math.max(0, Math.round(data[i] + alpha * (data[i] - blurData[i]))));
    output[i + 1] = Math.min(255, Math.max(0, Math.round(data[i + 1] + alpha * (data[i + 1] - blurData[i + 1]))));
    output[i + 2] = Math.min(255, Math.max(0, Math.round(data[i + 2] + alpha * (data[i + 2] - blurData[i + 2]))));
    output[i + 3] = data[i + 3];
  }

  return new ImageData(output, width, height);
}

/**
 * Load a File into an ImageBitmap, draw it onto a 224x224 canvas
 * with EXIF orientation correction, and return the canvas + context + quality report.
 */
async function loadAndResize(file: File): Promise<{
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  imageData: ImageData;
  qualityReport: QualityCheckResult;
}> {
  const [bitmap, orientation] = await Promise.all([
    createImageBitmap(file),
    getExifOrientation(file),
  ]);

  const { canvas, ctx } = createCanvas(TARGET_SIZE, TARGET_SIZE);

  // Draw with EXIF orientation applied, resizing to 224x224
  drawWithOrientation(ctx, bitmap, orientation, TARGET_SIZE, TARGET_SIZE);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE);
  const qualityReport = checkImageQuality(imageData);

  return { canvas, ctx, imageData, qualityReport };
}

/**
 * Full preprocessing pipeline:
 *
 * 1. Load image file into ImageBitmap
 * 2. Draw to 224x224 canvas with EXIF orientation correction
 * 3. Run quality check (blur, brightness)
 * 4. Apply CLAHE if brightness is borderline (40-80 dark or 200-240 bright)
 * 5. Convert to Float32Array tensor [1, 3, 224, 224] NCHW
 *    - Normalize: (pixel / 255 - mean) / std
 *    - ImageNet means: [0.485, 0.456, 0.406], stds: [0.229, 0.224, 0.225]
 * 6. Generate base64 thumbnail from the processed canvas
 */
export async function preprocessImage(file: File): Promise<PreprocessResult> {
  const { canvas, ctx, imageData, qualityReport } = await loadAndResize(file);

  let processedData = imageData;

  // Apply CLAHE for borderline brightness conditions
  const brightness = qualityReport.brightness;
  const isBorderlineDark = brightness >= CLAHE_DARK_LOW && brightness < CLAHE_DARK_HIGH;
  const isBorderlineBright = brightness > CLAHE_BRIGHT_LOW && brightness <= CLAHE_BRIGHT_HIGH;

  if (isBorderlineDark || isBorderlineBright) {
    processedData = applyCLAHE(processedData, 2.0, 8);

    // Write enhanced data back to canvas for thumbnail
    ctx.putImageData(processedData, 0, 0);
  }

  // Convert to NCHW tensor
  const tensor = imageDataToNCHWTensor(processedData);

  // Generate thumbnail
  const thumbnail = await canvasToDataURL(canvas);

  return {
    tensor,
    thumbnail,
    qualityReport,
  };
}

/**
 * Aggressive preprocessing for retry when model confidence is low.
 *
 * Applies stronger enhancement:
 * - CLAHE with higher clipLimit (4.0)
 * - Gamma correction (0.8 for dark images, 1.2 for bright images)
 * - Mild unsharp mask sharpening (alpha = 0.5)
 */
export async function aggressivePreprocess(file: File): Promise<PreprocessResult> {
  const { canvas, ctx, imageData, qualityReport } = await loadAndResize(file);

  let processedData = imageData;

  // Step 1: Apply CLAHE with higher clip limit
  processedData = applyCLAHE(processedData, 4.0, 8);

  // Step 2: Apply gamma correction based on brightness
  const brightness = qualityReport.brightness;
  if (brightness < 128) {
    // Dark image: brighten with gamma < 1
    processedData = applyGamma(processedData, 0.8);
  } else {
    // Bright image: darken with gamma > 1
    processedData = applyGamma(processedData, 1.2);
  }

  // Step 3: Apply unsharp mask for sharpening
  processedData = unsharpMask(processedData, 0.5);

  // Write processed data back to canvas for thumbnail
  ctx.putImageData(processedData, 0, 0);

  // Convert to NCHW tensor
  const tensor = imageDataToNCHWTensor(processedData);

  // Generate thumbnail
  const thumbnail = await canvasToDataURL(canvas);

  return {
    tensor,
    thumbnail,
    qualityReport,
  };
}
