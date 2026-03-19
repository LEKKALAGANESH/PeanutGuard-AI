/**
 * High-level AI pipeline functions used by ScanProcessor.
 * These wrap the lower-level ModelLoader + InferenceEngine classes
 * into simple File-in, result-out functions.
 *
 * NOTE: These will throw until ONNX model files exist in /public/models/.
 * ScanProcessor catches these errors and falls back to demo mode.
 */

export { ModelLoader } from './model-loader';
export type { ModelName } from './model-loader';
export { InferenceEngine } from './inference';
export type { InferenceResult } from './inference';
export { DISEASE_LABELS, NUM_CLASSES } from './labels';

import { ModelLoader } from './model-loader';
import { InferenceEngine } from './inference';
import type { InferenceResult } from './inference';
import { preprocessImage } from '@/lib/preprocessing/preprocess';
import type { Prediction, LesionDetection } from '@/types';

// Singleton instances — lazily created
let modelLoader: ModelLoader | null = null;
let engine: InferenceEngine | null = null;

function getLoader(): ModelLoader {
  if (!modelLoader) {
    modelLoader = new ModelLoader();
  }
  return modelLoader;
}

function getEngine(): InferenceEngine {
  if (!engine) {
    engine = new InferenceEngine(getLoader());
  }
  return engine;
}

/**
 * Run the peanut gate classifier on a File.
 * Returns true if the image contains a peanut plant.
 */
export async function runPeanutGate(file: File): Promise<boolean> {
  const { tensor } = await preprocessImage(file);
  const result = await getEngine().runPeanutGate(tensor);
  return result.isPeanut;
}

/**
 * Run disease classification on a File.
 * Returns top-3 predictions and which model was used.
 */
export async function classifyDisease(file: File): Promise<{
  predictions: Prediction[];
  modelUsed: 'mobilenetv3_large' | 'mobilenetv3_small';
}> {
  const { tensor } = await preprocessImage(file);
  const inf = getEngine();
  const predictions = await inf.runClassification(tensor);
  const modelUsed = getLoader().getClassifierModel() === 'mobilenetv3_large'
    ? 'mobilenetv3_large' as const
    : 'mobilenetv3_small' as const;
  return { predictions, modelUsed };
}

/**
 * Run lesion detection on a File.
 * Returns bounding boxes and a severity score.
 */
export async function detectLesions(file: File): Promise<{
  lesions: LesionDetection[];
  severityScore: number;
}> {
  const { tensor } = await preprocessImage(file);
  const lesions = await getEngine().runLesionDetection(tensor, 224, 224);

  // Calculate severity from lesion count and coverage
  const totalArea = lesions.reduce((sum, l) => sum + l.width * l.height, 0);
  const imageArea = 224 * 224;
  const coveragePct = (totalArea / imageArea) * 100;

  let severityScore: number;
  if (lesions.length === 0) severityScore = 1;
  else if (lesions.length <= 5 && coveragePct < 5) severityScore = 2;
  else if (lesions.length <= 15 && coveragePct < 25) severityScore = 3;
  else if (coveragePct < 50) severityScore = 4;
  else severityScore = 5;

  return { lesions, severityScore };
}

/**
 * Run the complete 3-stage pipeline (gate → classify → detect) on a File.
 * Returns a full InferenceResult. This is the preferred single-call API.
 */
export async function runFullScan(file: File): Promise<InferenceResult & { severityScore: number }> {
  const { tensor } = await preprocessImage(file);
  const result = await getEngine().runFullPipeline(tensor, 224, 224);

  // Calculate severity from lesion count and coverage
  const totalArea = result.lesions.reduce((sum, l) => sum + l.width * l.height, 0);
  const imageArea = 224 * 224;
  const coveragePct = (totalArea / imageArea) * 100;

  let severityScore: number;
  if (result.lesions.length === 0) severityScore = 1;
  else if (result.lesions.length <= 5 && coveragePct < 5) severityScore = 2;
  else if (result.lesions.length <= 15 && coveragePct < 25) severityScore = 3;
  else if (coveragePct < 50) severityScore = 4;
  else severityScore = 5;

  return { ...result, severityScore };
}

/**
 * Check if ONNX models are available by attempting to load the peanut gate.
 * Returns true if models exist and can be loaded, false otherwise.
 */
export async function checkModelsAvailable(): Promise<boolean> {
  try {
    await getLoader().loadModel('peanut_gate');
    return true;
  } catch {
    return false;
  }
}

/**
 * Release all loaded ONNX model sessions and free WASM memory.
 * Call when navigating away from the scan view.
 */
export async function disposeModels(): Promise<void> {
  if (engine) {
    await engine.dispose();
    engine = null;
  }
  if (modelLoader) {
    await modelLoader.releaseAll();
    modelLoader = null;
  }
}
