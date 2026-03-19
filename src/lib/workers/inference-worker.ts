/**
 * Web Worker for ONNX inference — runs in a separate thread.
 *
 * Self-contained: replicates preprocessing + inference logic because
 * Next.js webpack doesn't resolve @/ path aliases in Worker contexts.
 * Uses OffscreenCanvas (workers have no DOM).
 */

import * as ort from 'onnxruntime-web';

// ---------------------------------------------------------------------------
// Constants (replicated from main thread modules)
// ---------------------------------------------------------------------------

const TARGET_SIZE = 224;
const IMAGENET_MEAN: [number, number, number] = [0.485, 0.456, 0.406];
const IMAGENET_STD: [number, number, number] = [0.229, 0.224, 0.225];

const GATE_THRESHOLD = 0.5;
const LESION_CONFIDENCE_THRESHOLD = 0.3;
const NMS_IOU_THRESHOLD = 0.45;
const TOP_K = 3;
const LARGE_MODEL_RAM_THRESHOLD_GB = 3;

const MODEL_PATHS: Record<string, string> = {
  peanut_gate: '/models/peanut_gate.onnx',
  mobilenetv3_large: '/models/mobilenetv3_large.onnx',
  mobilenetv3_small: '/models/mobilenetv3_small.onnx',
  yolov11_nano: '/models/yolov11_nano.onnx',
};

const DISEASE_LABELS: string[] = [
  'healthy', 'early_leaf_spot', 'late_leaf_spot', 'rust', 'white_mold',
  'aspergillus_aflatoxin', 'web_blotch', 'collar_rot', 'rosette_virus',
  'bud_necrosis', 'peanut_mottle', 'bacterial_wilt', 'root_knot_nematode',
  'iron_chlorosis', 'nitrogen_deficiency', 'calcium_deficiency',
  'boron_deficiency', 'drought_stress', 'herbicide_injury',
];

// ---------------------------------------------------------------------------
// Session cache
// ---------------------------------------------------------------------------

const sessions = new Map<string, ort.InferenceSession>();
let wasmConfigured = false;

function configureWasm(): void {
  if (wasmConfigured) return;
  try {
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
    ort.env.wasm.numThreads = 1; // single-threaded per worker
  } catch {
    // ignore
  }
  wasmConfigured = true;
}

async function loadModel(name: string): Promise<ort.InferenceSession> {
  const existing = sessions.get(name);
  if (existing) return existing;

  const path = MODEL_PATHS[name];
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to fetch model ${name}: ${response.status}`);

  const buffer = await response.arrayBuffer();
  const session = await ort.InferenceSession.create(new Uint8Array(buffer), {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });
  sessions.set(name, session);
  return session;
}

function getClassifierModel(): string {
  const ram = (self.navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  return ram >= LARGE_MODEL_RAM_THRESHOLD_GB ? 'mobilenetv3_large' : 'mobilenetv3_small';
}

// ---------------------------------------------------------------------------
// Preprocessing (self-contained, OffscreenCanvas only)
// ---------------------------------------------------------------------------

function imageDataToNCHWTensor(imageData: ImageData): Float32Array {
  const { data, width, height } = imageData;
  const channelSize = width * height;
  const tensor = new Float32Array(3 * channelSize);

  for (let i = 0; i < channelSize; i++) {
    const srcOffset = i * 4;
    tensor[i] = (data[srcOffset] / 255 - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
    tensor[channelSize + i] = (data[srcOffset + 1] / 255 - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
    tensor[2 * channelSize + i] = (data[srcOffset + 2] / 255 - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
  }

  return tensor;
}

async function preprocessBuffer(buffer: ArrayBuffer): Promise<{
  tensor: Float32Array;
  thumbnail: string;
  width: number;
  height: number;
}> {
  const blob = new Blob([buffer]);
  const bitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(TARGET_SIZE, TARGET_SIZE);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Failed to get OffscreenCanvas 2D context in worker');
  }
  ctx.drawImage(bitmap, 0, 0, TARGET_SIZE, TARGET_SIZE);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE);
  const tensor = imageDataToNCHWTensor(imageData);

  // Generate thumbnail as base64
  const thumbBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
  const thumbUrl = await blobToDataURL(thumbBlob);

  return { tensor, thumbnail: thumbUrl, width: TARGET_SIZE, height: TARGET_SIZE };
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to read as data URL'));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// ---------------------------------------------------------------------------
// Inference pipeline (self-contained)
// ---------------------------------------------------------------------------

function softmax(logits: Float32Array | number[]): number[] {
  const arr = Array.from(logits);
  const max = Math.max(...arr);
  const exps = arr.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

async function runGate(tensor: Float32Array): Promise<{ isPeanut: boolean; confidence: number }> {
  const session = await loadModel('peanut_gate');
  const inputTensor = new ort.Tensor('float32', tensor, [1, 3, 224, 224]);
  const feeds: Record<string, ort.Tensor> = { [session.inputNames[0]]: inputTensor };
  const results = await session.run(feeds);
  const data = results[session.outputNames[0]].data as Float32Array;

  let confidence: number;
  if (data.length === 1) {
    confidence = data[0];
  } else {
    const probs = softmax(data);
    confidence = probs[1];
  }
  return { isPeanut: confidence >= GATE_THRESHOLD, confidence };
}

async function runClassification(tensor: Float32Array): Promise<Array<{ diseaseLabel: string; confidence: number }>> {
  const modelName = getClassifierModel();
  const session = await loadModel(modelName);
  const inputTensor = new ort.Tensor('float32', tensor, [1, 3, 224, 224]);
  const feeds: Record<string, ort.Tensor> = { [session.inputNames[0]]: inputTensor };
  const results = await session.run(feeds);
  const logits = results[session.outputNames[0]].data as Float32Array;
  const probs = softmax(logits);

  const predictions = probs
    .map((p, i) => ({ diseaseLabel: DISEASE_LABELS[i] ?? `class_${i}`, confidence: p }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, TOP_K);

  return predictions;
}

async function runDetection(
  tensor: Float32Array,
  width: number,
  height: number,
): Promise<Array<{ x: number; y: number; width: number; height: number; confidence: number }>> {
  try {
    const session = await loadModel('yolov11_nano');
    const inputTensor = new ort.Tensor('float32', tensor, [1, 3, 224, 224]);
    const feeds: Record<string, ort.Tensor> = { [session.inputNames[0]]: inputTensor };
    const results = await session.run(feeds);
    const output = results[session.outputNames[0]];
    const data = output.data as Float32Array;
    const dims = output.dims as number[];

    const scaleX = width / 224;
    const scaleY = height / 224;
    const detections: Array<{ x: number; y: number; width: number; height: number; confidence: number }> = [];

    if (dims.length === 3) {
      const [, dim1, dim2] = dims;
      const isTransposed = dim1 < dim2 && dim1 >= 5;
      const numDets = isTransposed ? dim2 : dim1;
      const stride = isTransposed ? dim1 : dim2;

      for (let i = 0; i < numDets; i++) {
        let cx: number, cy: number, w: number, h: number, conf: number;
        if (isTransposed) {
          cx = data[0 * numDets + i];
          cy = data[1 * numDets + i];
          w = data[2 * numDets + i];
          h = data[3 * numDets + i];
          conf = stride === 5 ? data[4 * numDets + i] : 0;
          if (stride > 5) {
            for (let c = 4; c < stride; c++) {
              const s = data[c * numDets + i];
              if (s > conf) conf = s;
            }
          }
        } else {
          const off = i * stride;
          cx = data[off]; cy = data[off + 1]; w = data[off + 2]; h = data[off + 3];
          conf = stride === 5 ? data[off + 4] : 0;
          if (stride > 5) {
            for (let c = 4; c < stride; c++) {
              const s = data[off + c];
              if (s > conf) conf = s;
            }
          }
        }
        if (conf >= LESION_CONFIDENCE_THRESHOLD) {
          detections.push({
            x: (cx - w / 2) * scaleX,
            y: (cy - h / 2) * scaleY,
            width: w * scaleX,
            height: h * scaleY,
            confidence: conf,
          });
        }
      }
    }

    // Simple greedy NMS
    detections.sort((a, b) => b.confidence - a.confidence);
    const kept: typeof detections = [];
    const suppressed = new Set<number>();
    for (let i = 0; i < detections.length; i++) {
      if (suppressed.has(i)) continue;
      kept.push(detections[i]);
      for (let j = i + 1; j < detections.length; j++) {
        if (suppressed.has(j)) continue;
        const a = detections[i], b = detections[j];
        const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
        const x2 = Math.min(a.x + a.width, b.x + b.width);
        const y2 = Math.min(a.y + a.height, b.y + b.height);
        const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
        const union = a.width * a.height + b.width * b.height - inter;
        if (union > 0 && inter / union >= NMS_IOU_THRESHOLD) suppressed.add(j);
      }
    }

    return kept;
  } catch {
    return [];
  }
}

function computeSeverity(predictions: Array<{ diseaseLabel: string; confidence: number }>): number {
  if (predictions.length === 0) return 0;
  const top = predictions[0];
  if (top.diseaseLabel === 'healthy') return 0;
  if (top.confidence >= 0.9) return 5;
  if (top.confidence >= 0.75) return 4;
  if (top.confidence >= 0.6) return 3;
  if (top.confidence >= 0.4) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

const ctx = self as unknown as Worker;

ctx.onmessage = async (e: MessageEvent) => {
  const msg = e.data;

  if (msg.type === 'init') {
    configureWasm();
    ctx.postMessage({ type: 'ready' });
    return;
  }

  if (msg.type === 'dispose') {
    for (const [, session] of sessions) {
      try { await session.release(); } catch { /* ignore */ }
    }
    sessions.clear();
    return;
  }

  if (msg.type === 'infer') {
    const { id, imageBuffer } = msg;
    try {
      // Preprocessing
      ctx.postMessage({ type: 'progress', id, phase: 'preprocessing' });
      const { tensor, thumbnail, width, height } = await preprocessBuffer(imageBuffer);

      // Gate
      ctx.postMessage({ type: 'progress', id, phase: 'gate' });
      const gateResult = await runGate(tensor);

      if (!gateResult.isPeanut) {
        ctx.postMessage({
          type: 'result',
          id,
          thumbnail,
          result: {
            isPeanut: false,
            peanutConfidence: gateResult.confidence,
            predictions: [],
            lesions: [],
            severityScore: 0,
            modelUsed: getClassifierModel(),
            inferenceMs: 0,
          },
        });
        return;
      }

      // Classification
      ctx.postMessage({ type: 'progress', id, phase: 'classifying' });
      const predictions = await runClassification(tensor);

      // Detection
      ctx.postMessage({ type: 'progress', id, phase: 'detecting' });
      const lesions = await runDetection(tensor, width, height);

      ctx.postMessage({
        type: 'result',
        id,
        thumbnail,
        result: {
          isPeanut: true,
          peanutConfidence: gateResult.confidence,
          predictions,
          lesions,
          severityScore: computeSeverity(predictions),
          modelUsed: getClassifierModel(),
          inferenceMs: 0, // timing tracked by pool
        },
      });
    } catch (err) {
      ctx.postMessage({
        type: 'error',
        id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
};
