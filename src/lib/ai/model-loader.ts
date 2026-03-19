import * as ort from 'onnxruntime-web';

/**
 * Identifiers for the four ONNX models used by PeanutGuard.
 *
 * - `peanut_gate`       – binary "is this a peanut plant?" gate (~2 MB)
 * - `mobilenetv3_large` – primary 19-class classifier (~8 MB, needs >= 3 GB RAM)
 * - `mobilenetv3_small` – fallback 19-class classifier (~4 MB, for low-RAM devices)
 * - `yolov11_nano`      – lesion bounding-box detector (~5 MB, loaded on-demand)
 */
export type ModelName =
  | 'peanut_gate'
  | 'mobilenetv3_large'
  | 'mobilenetv3_small'
  | 'yolov11_nano';

/** Map from model name to its path under the public `/models/` directory. */
const MODEL_PATHS: Record<ModelName, string> = {
  peanut_gate: '/models/peanut_gate.onnx',
  mobilenetv3_large: '/models/mobilenetv3_large.onnx',
  mobilenetv3_small: '/models/mobilenetv3_small.onnx',
  yolov11_nano: '/models/yolov11_nano.onnx',
};

/** Minimum device RAM (in GB) required to use the large classifier. */
const LARGE_MODEL_RAM_THRESHOLD_GB = 3;

/**
 * Manages ONNX inference sessions with lazy loading, memory-aware fallback,
 * and explicit disposal.
 *
 * Usage:
 * ```ts
 * const loader = new ModelLoader();
 * const session = await loader.loadModel('peanut_gate');
 * // ... run inference ...
 * await loader.releaseModel('peanut_gate');
 * ```
 */
export class ModelLoader {
  /** Cached, ready-to-use sessions keyed by model name. */
  private sessions: Map<ModelName, ort.InferenceSession> = new Map();

  /**
   * In-flight loading promises.  Prevents duplicate fetches when the same
   * model is requested concurrently.
   */
  private loading: Map<ModelName, Promise<ort.InferenceSession>> = new Map();

  /** Whether the WASM backend has been configured. */
  private static wasmConfigured = false;

  constructor() {
    this.configureWasm();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Load a model by name.  Returns the existing session if already loaded,
   * or fetches + creates a new one.  Concurrent calls for the same model
   * share a single in-flight fetch.
   *
   * @param modelName - Which model to load.
   * @returns A ready-to-use {@link ort.InferenceSession}.
   * @throws If the model file cannot be fetched or the session fails to create.
   */
  async loadModel(modelName: ModelName): Promise<ort.InferenceSession> {
    // Return cached session immediately.
    const existing = this.sessions.get(modelName);
    if (existing) {
      return existing;
    }

    // Deduplicate concurrent requests.
    const inflight = this.loading.get(modelName);
    if (inflight) {
      return inflight;
    }

    const promise = this.createSession(modelName);
    this.loading.set(modelName, promise);

    try {
      const session = await promise;
      this.sessions.set(modelName, session);
      return session;
    } finally {
      this.loading.delete(modelName);
    }
  }

  /**
   * Release a single model's session and free its WASM memory.
   *
   * @param modelName - Which model to release.
   */
  async releaseModel(modelName: ModelName): Promise<void> {
    const session = this.sessions.get(modelName);
    if (session) {
      try {
        await session.release();
      } catch {
        // Session may already be released; swallow the error.
      }
      this.sessions.delete(modelName);
    }
  }

  /**
   * Release every loaded session and clear caches.  Call this when the scan
   * view unmounts or the user navigates away.
   */
  async releaseAll(): Promise<void> {
    const entries = Array.from(this.sessions.entries());
    await Promise.allSettled(
      entries.map(async ([name]) => this.releaseModel(name)),
    );
    this.sessions.clear();
  }

  /**
   * Estimate the device RAM in gigabytes.
   *
   * Uses the {@link https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory Navigator.deviceMemory}
   * API when available; defaults to 4 GB otherwise.
   *
   * @returns Estimated device RAM in GB.
   */
  getDeviceRAM(): number {
    if (
      typeof navigator !== 'undefined' &&
      'deviceMemory' in navigator &&
      typeof (navigator as NavigatorWithDeviceMemory).deviceMemory === 'number'
    ) {
      return (navigator as NavigatorWithDeviceMemory).deviceMemory;
    }
    return 4; // conservative default
  }

  /**
   * Choose the appropriate classifier based on available device RAM.
   *
   * - >= 3 GB RAM -> `mobilenetv3_large`  (higher accuracy, ~8 MB)
   * - <  3 GB RAM -> `mobilenetv3_small`  (lighter, ~4 MB)
   *
   * @returns The recommended classifier model name.
   */
  getClassifierModel(): ModelName {
    return this.getDeviceRAM() >= LARGE_MODEL_RAM_THRESHOLD_GB
      ? 'mobilenetv3_large'
      : 'mobilenetv3_small';
  }

  /**
   * Check whether a model session is currently loaded and ready.
   *
   * @param modelName - The model to check.
   * @returns `true` if the session is in memory.
   */
  isLoaded(modelName: ModelName): boolean {
    return this.sessions.has(modelName);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * One-time configuration of the ONNX Runtime WASM backend.  Points the WASM
   * binary paths to a CDN to avoid bundling large `.wasm` files.
   */
  private configureWasm(): void {
    if (ModelLoader.wasmConfigured) {
      return;
    }

    // Use the CDN-hosted WASM binaries that match the installed ort version.
    // Falls back gracefully if running server-side (no `ort.env`).
    try {
      ort.env.wasm.wasmPaths =
        'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';

      // Prefer multi-threaded execution when available.
      ort.env.wasm.numThreads = Math.min(
        navigator?.hardwareConcurrency ?? 4,
        4,
      );
    } catch {
      // Server-side or test environment — silently skip.
    }

    ModelLoader.wasmConfigured = true;
  }

  /**
   * Fetch a model file and create an inference session.
   *
   * @param modelName - Which model to create.
   * @returns A newly created {@link ort.InferenceSession}.
   */
  private async createSession(
    modelName: ModelName,
  ): Promise<ort.InferenceSession> {
    const path = MODEL_PATHS[modelName];

    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch model "${modelName}" from ${path}: HTTP ${response.status}`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();

      const session = await ort.InferenceSession.create(
        new Uint8Array(arrayBuffer),
        {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        },
      );

      return session;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `ModelLoader: could not load "${modelName}" — ${message}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Augment Navigator type for `deviceMemory` (not in default TS lib).
// ---------------------------------------------------------------------------
interface NavigatorWithDeviceMemory extends Navigator {
  deviceMemory: number;
}
