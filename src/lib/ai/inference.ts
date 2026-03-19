import * as ort from 'onnxruntime-web';
import type { Prediction, LesionDetection } from '@/types';
import { ModelLoader } from './model-loader';
import { DISEASE_LABELS, NUM_CLASSES } from './labels';

// ---------------------------------------------------------------------------
// Confidence thresholds
// ---------------------------------------------------------------------------

/** Peanut gate must be >= this to proceed with classification. */
const GATE_THRESHOLD = 0.5;

/** Classification confidence below this triggers a "retry preprocessing" hint. */
const CONFIDENCE_RETRY = 0.3;

/** Classification confidence below this (but >= RETRY) is flagged "uncertain". */
const CONFIDENCE_UNCERTAIN = 0.6;

/** Minimum confidence to keep a YOLO lesion detection. */
const LESION_CONFIDENCE_THRESHOLD = 0.3;

/** IoU threshold for non-max suppression of YOLO bounding boxes. */
const NMS_IOU_THRESHOLD = 0.45;

/** Number of top predictions to return. */
const TOP_K = 3;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Possible status outcomes of a full scan pipeline run.
 *
 * - `confirmed`           – top prediction confidence >= 0.6
 * - `uncertain`           – top prediction confidence in [0.3, 0.6)
 * - `retry_preprocessing` – top prediction confidence < 0.3 (likely bad input)
 * - `not_peanut`          – gate model rejected the image as non-peanut
 */
export type InferenceStatus =
  | 'confirmed'
  | 'uncertain'
  | 'retry_preprocessing'
  | 'not_peanut';

/** Full result of the PeanutGuard scan pipeline. */
export interface InferenceResult {
  status: InferenceStatus;
  isPeanut: boolean;
  peanutConfidence: number;
  /** Top-3 disease/disorder predictions (sorted by confidence desc). */
  predictions: Prediction[];
  /** Detected lesion bounding boxes (after NMS). */
  lesions: LesionDetection[];
  /** Which classifier was used (depends on device RAM). */
  modelUsed: 'mobilenetv3_large' | 'mobilenetv3_small';
  /** Wall-clock time for the entire pipeline in milliseconds. */
  totalInferenceMs: number;
}

// ---------------------------------------------------------------------------
// InferenceEngine
// ---------------------------------------------------------------------------

/**
 * Orchestrates the full PeanutGuard scan pipeline:
 *
 * 1. **Peanut gate** — fast binary check to reject non-peanut images early.
 * 2. **Classification** — 19-class disease / disorder classification.
 * 3. **Lesion detection** — YOLO bounding boxes around visible lesions.
 *
 * All inference runs on-device via ONNX Runtime Web (WASM backend).
 */
export class InferenceEngine {
  constructor(private modelLoader: ModelLoader) {}

  // -------------------------------------------------------------------------
  // Full pipeline
  // -------------------------------------------------------------------------

  /**
   * Run the complete scan pipeline on a preprocessed image tensor.
   *
   * @param tensor - Float32Array of shape (1, 3, 224, 224) in NCHW format,
   *                 normalised to [0, 1] or ImageNet mean/std.
   * @param width  - Original image width (used for lesion coordinate scaling).
   * @param height - Original image height.
   * @returns A structured {@link InferenceResult}.
   */
  async runFullPipeline(
    tensor: Float32Array,
    width: number,
    height: number,
  ): Promise<InferenceResult> {
    const pipelineStart = performance.now();

    // 1. Peanut gate --------------------------------------------------------
    const gateResult = await this.runPeanutGate(tensor);

    if (!gateResult.isPeanut) {
      return {
        status: 'not_peanut',
        isPeanut: false,
        peanutConfidence: gateResult.confidence,
        predictions: [],
        lesions: [],
        modelUsed: this.modelLoader.getClassifierModel() as
          | 'mobilenetv3_large'
          | 'mobilenetv3_small',
        totalInferenceMs: performance.now() - pipelineStart,
      };
    }

    // 2. Classification ------------------------------------------------------
    const predictions = await this.runClassification(tensor);
    const topConfidence = predictions.length > 0 ? predictions[0].confidence : 0;

    let status: InferenceStatus;
    if (topConfidence < CONFIDENCE_RETRY) {
      status = 'retry_preprocessing';
    } else if (topConfidence < CONFIDENCE_UNCERTAIN) {
      status = 'uncertain';
    } else {
      status = 'confirmed';
    }

    // 3. Lesion detection (lazy — only when classification succeeded) ---------
    let lesions: LesionDetection[] = [];
    if (status !== 'retry_preprocessing') {
      try {
        lesions = await this.runLesionDetection(tensor, width, height);
      } catch {
        // Lesion detection is non-critical; degrade gracefully.
        lesions = [];
      }
    }

    const classifierModel = this.modelLoader.getClassifierModel() as
      | 'mobilenetv3_large'
      | 'mobilenetv3_small';

    return {
      status,
      isPeanut: true,
      peanutConfidence: gateResult.confidence,
      predictions,
      lesions,
      modelUsed: classifierModel,
      totalInferenceMs: performance.now() - pipelineStart,
    };
  }

  // -------------------------------------------------------------------------
  // Individual pipeline stages
  // -------------------------------------------------------------------------

  /**
   * Run the peanut gate model to determine if the image contains a peanut plant.
   *
   * @param tensor - Float32Array of shape (1, 3, 224, 224).
   * @returns `isPeanut` (true if confidence >= 0.5) and the raw confidence score.
   */
  async runPeanutGate(
    tensor: Float32Array,
  ): Promise<{ isPeanut: boolean; confidence: number }> {
    const session = await this.modelLoader.loadModel('peanut_gate');
    const inputName = session.inputNames[0];

    const inputTensor = new ort.Tensor('float32', tensor, [1, 3, 224, 224]);
    const feeds: Record<string, ort.Tensor> = { [inputName]: inputTensor };

    const results = await session.run(feeds);
    const outputName = session.outputNames[0];
    const output = results[outputName];
    const data = output.data as Float32Array;

    // Gate model outputs a single sigmoid value or a 2-class softmax.
    // Handle both: if length == 1 treat as sigmoid; else take class-1 prob.
    let confidence: number;
    if (data.length === 1) {
      confidence = data[0];
    } else {
      // 2-class output: [not_peanut, peanut]
      const softmaxed = softmax(data);
      confidence = softmaxed[1];
    }

    return {
      isPeanut: confidence >= GATE_THRESHOLD,
      confidence,
    };
  }

  /**
   * Run the 19-class disease classifier and return the top-3 predictions.
   *
   * Automatically selects `mobilenetv3_large` or `mobilenetv3_small` based on
   * available device RAM.
   *
   * @param tensor - Float32Array of shape (1, 3, 224, 224).
   * @returns Array of up to 3 {@link Prediction} objects sorted by confidence desc.
   */
  async runClassification(tensor: Float32Array): Promise<Prediction[]> {
    const modelName = this.modelLoader.getClassifierModel();
    const session = await this.modelLoader.loadModel(modelName);
    const inputName = session.inputNames[0];

    const inputTensor = new ort.Tensor('float32', tensor, [1, 3, 224, 224]);
    const feeds: Record<string, ort.Tensor> = { [inputName]: inputTensor };

    const results = await session.run(feeds);
    const outputName = session.outputNames[0];
    const output = results[outputName];
    const logits = output.data as Float32Array;

    // Apply softmax to convert logits to probabilities.
    const probabilities = softmax(logits);

    // Build (label, confidence) pairs and sort descending.
    const predictions: Prediction[] = [];
    for (let i = 0; i < Math.min(probabilities.length, NUM_CLASSES); i++) {
      predictions.push({
        diseaseLabel: DISEASE_LABELS[i],
        confidence: probabilities[i],
      });
    }

    predictions.sort((a, b) => b.confidence - a.confidence);

    return predictions.slice(0, TOP_K);
  }

  /**
   * Run YOLOv11-nano to detect lesion bounding boxes in the image.
   *
   * The model is loaded on-demand (lazy) and results are filtered by a
   * confidence threshold and non-max suppression.
   *
   * @param tensor - Float32Array of shape (1, 3, 224, 224).
   * @param width  - Original image width for coordinate scaling.
   * @param height - Original image height for coordinate scaling.
   * @returns Array of {@link LesionDetection} objects.
   */
  async runLesionDetection(
    tensor: Float32Array,
    width: number,
    height: number,
  ): Promise<LesionDetection[]> {
    const session = await this.modelLoader.loadModel('yolov11_nano');
    const inputName = session.inputNames[0];

    const inputTensor = new ort.Tensor('float32', tensor, [1, 3, 224, 224]);
    const feeds: Record<string, ort.Tensor> = { [inputName]: inputTensor };

    const results = await session.run(feeds);
    const outputName = session.outputNames[0];
    const output = results[outputName];
    const data = output.data as Float32Array;

    // YOLOv11-nano output shape is typically (1, num_detections, 5+num_classes)
    // or transposed (1, 5+num_classes, num_detections).
    // We handle the common (1, N, 5) format for single-class lesion detection
    // where each row is [cx, cy, w, h, confidence].
    const detections = parseYoloOutput(data, output.dims as number[], width, height);

    // Filter by confidence threshold.
    const filtered = detections.filter(
      (d) => d.confidence >= LESION_CONFIDENCE_THRESHOLD,
    );

    // Apply non-max suppression.
    return nms(filtered, NMS_IOU_THRESHOLD);
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  /**
   * Release all loaded models.  Call this when the scan view is destroyed.
   */
  async dispose(): Promise<void> {
    await this.modelLoader.releaseAll();
  }
}

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

/**
 * Numerically-stable softmax over an array of logits.
 *
 * @param logits - Raw model output values.
 * @returns Probability distribution summing to 1.
 */
function softmax(logits: Float32Array | number[]): number[] {
  const maxLogit = Math.max(...Array.from(logits));
  const exps = Array.from(logits).map((v) => Math.exp(v - maxLogit));
  const sumExp = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sumExp);
}

// ---------------------------------------------------------------------------
// YOLO output parsing
// ---------------------------------------------------------------------------

/**
 * Parse raw YOLO output tensor into {@link LesionDetection} objects.
 *
 * Handles two common output layouts:
 * - **(1, N, 5+C)** — each of N detections is a row of [cx, cy, w, h, conf, ...classes]
 * - **(1, 5+C, N)** — transposed; columns are detections (common in ultralytics exports)
 *
 * For single-class (lesion-only) detection, C = 0 or 1.
 *
 * @param data   - Flat Float32Array of model output values.
 * @param dims   - Shape of the output tensor, e.g. [1, 8400, 5].
 * @param width  - Original image width for coordinate scaling.
 * @param height - Original image height for coordinate scaling.
 */
function parseYoloOutput(
  data: Float32Array,
  dims: number[],
  width: number,
  height: number,
): LesionDetection[] {
  const detections: LesionDetection[] = [];

  // The model input is 224x224; scale factors to map back to original image.
  const scaleX = width / 224;
  const scaleY = height / 224;

  if (dims.length === 3) {
    const [, dim1, dim2] = dims;

    // Determine layout: if dim2 >= 5 and dim1 > dim2 => (1, N, 5+C)
    // Otherwise if dim1 >= 5 and dim2 > dim1 => (1, 5+C, N) (transposed).
    const isTransposed = dim1 < dim2 && dim1 >= 5;
    const numDetections = isTransposed ? dim2 : dim1;
    const stride = isTransposed ? dim1 : dim2;

    for (let i = 0; i < numDetections; i++) {
      let cx: number, cy: number, w: number, h: number, conf: number;

      if (isTransposed) {
        // (1, 5+C, N) — read column i across rows.
        cx = data[0 * numDetections + i];
        cy = data[1 * numDetections + i];
        w = data[2 * numDetections + i];
        h = data[3 * numDetections + i];
        // For single-class: objectness is at row 4.
        // For multi-class: take max of class scores at rows 4..stride-1.
        if (stride === 5) {
          conf = data[4 * numDetections + i];
        } else {
          conf = 0;
          for (let c = 4; c < stride; c++) {
            const score = data[c * numDetections + i];
            if (score > conf) conf = score;
          }
        }
      } else {
        // (1, N, 5+C) — read row i.
        const offset = i * stride;
        cx = data[offset];
        cy = data[offset + 1];
        w = data[offset + 2];
        h = data[offset + 3];
        if (stride === 5) {
          conf = data[offset + 4];
        } else {
          conf = 0;
          for (let c = 4; c < stride; c++) {
            const score = data[offset + c];
            if (score > conf) conf = score;
          }
        }
      }

      // Convert from center-format to top-left corner format and scale.
      detections.push({
        x: (cx - w / 2) * scaleX,
        y: (cy - h / 2) * scaleY,
        width: w * scaleX,
        height: h * scaleY,
        confidence: conf,
      });
    }
  } else if (dims.length === 2) {
    // Flat (N, 5) — no batch dimension.
    const [numDetections, stride] = dims;
    for (let i = 0; i < numDetections; i++) {
      const offset = i * stride;
      const cx = data[offset];
      const cy = data[offset + 1];
      const w = data[offset + 2];
      const h = data[offset + 3];
      const conf = stride === 5
        ? data[offset + 4]
        : Math.max(...Array.from(data.slice(offset + 4, offset + stride)));

      detections.push({
        x: (cx - w / 2) * scaleX,
        y: (cy - h / 2) * scaleY,
        width: w * scaleX,
        height: h * scaleY,
        confidence: conf,
      });
    }
  }

  return detections;
}

// ---------------------------------------------------------------------------
// Non-max suppression
// ---------------------------------------------------------------------------

/**
 * Greedy non-max suppression.  Removes overlapping detections that exceed
 * the given IoU threshold, keeping the highest-confidence one.
 *
 * @param detections - Candidate detections sorted by confidence is NOT required
 *                     (this function sorts internally).
 * @param iouThreshold - Maximum allowed IoU between kept detections.
 * @returns Filtered array of detections.
 */
function nms(
  detections: LesionDetection[],
  iouThreshold: number,
): LesionDetection[] {
  if (detections.length === 0) return [];

  // Sort descending by confidence.
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);

  const kept: LesionDetection[] = [];
  const suppressed = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue;

    kept.push(sorted[i]);

    for (let j = i + 1; j < sorted.length; j++) {
      if (suppressed.has(j)) continue;

      if (iou(sorted[i], sorted[j]) >= iouThreshold) {
        suppressed.add(j);
      }
    }
  }

  return kept;
}

/**
 * Compute intersection-over-union between two bounding boxes.
 *
 * Both boxes are in (x, y, width, height) format where (x, y) is the
 * top-left corner.
 */
function iou(a: LesionDetection, b: LesionDetection): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (intersection === 0) return 0;

  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const union = areaA + areaB - intersection;

  return union > 0 ? intersection / union : 0;
}
