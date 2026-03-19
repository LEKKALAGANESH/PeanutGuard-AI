'use client';

import { useState, useCallback, useEffect } from 'react';
import { checkImageQuality, type QualityCheckResult } from '@/lib/preprocessing/quality-check';
import {
  mirrorHorizontal,
  adjustContrast,
  rotate90,
  TTA_PRESETS,
} from '@/lib/preprocessing/image-augmentation';

/** All 17 testing images copied to public/testing-images/ */
const TEST_IMAGE_FILENAMES = [
  'Aspergillus Crown Rot.jpg',
  'Cylindrocladium Black Rot (CBR).jpg',
  'download.jpg',
  'Groundnut_Botrytis-blight_3.png',
  'images (1).jpg',
  'images (2).jpg',
  'images (3).jpg',
  'images (4).jpg',
  'images (5).jpg',
  'images (6).jpg',
  'images.jpg',
  'images_1.jpg',
  'Rhizoctonia Limb Rot.jpg',
  'Root-Knot Nematodes.jpg',
  'Sclerotinia Blight.jpg',
  'Tomato Spotted Wilt Virus (TSWV).jpg',
  'unnamed.jpg',
];

interface ImageTestResult {
  filename: string;
  originalSize: string;
  quality: QualityCheckResult;
  augmentations: {
    name: string;
    quality: QualityCheckResult;
  }[];
  thumbnail: string;
  processingMs: number;
}

const TARGET_SIZE = 224;

async function processImageFile(file: File): Promise<ImageTestResult> {
  const start = performance.now();

  // Load image
  const bitmap = await createImageBitmap(file);
  const originalSize = `${bitmap.width}x${bitmap.height}`;

  // Resize to 224x224 (same as inference pipeline)
  const canvas = new OffscreenCanvas(TARGET_SIZE, TARGET_SIZE);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, TARGET_SIZE, TARGET_SIZE);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE);

  // Run quality check
  const quality = checkImageQuality(imageData);

  // Run augmentations and quality check each
  const augmentations = TTA_PRESETS.slice(1).map((preset) => {
    const augmented = preset.apply(imageData);
    const augQuality = checkImageQuality(augmented);
    return { name: preset.name, quality: augQuality };
  });

  // Generate thumbnail
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
  const thumbnail = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

  return {
    filename: file.name,
    originalSize,
    quality,
    augmentations,
    thumbnail,
    processingMs: performance.now() - start,
  };
}

function StatusBadge({ passed }: { passed: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
        passed
          ? 'bg-green-500/20 text-green-400'
          : 'bg-red-500/20 text-red-400'
      }`}
    >
      {passed ? 'PASS' : 'FAIL'}
    </span>
  );
}

function MetricBar({
  label,
  value,
  max,
  threshold,
  unit,
  invert,
}: {
  label: string;
  value: number;
  max: number;
  threshold: number;
  unit: string;
  invert?: boolean;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const threshPct = (threshold / max) * 100;
  const isBad = invert ? value > threshold : value < threshold;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className={isBad ? 'font-bold text-red-400' : 'text-gray-300'}>
          {value.toFixed(1)}{unit}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-gray-700">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${isBad ? 'bg-red-500' : 'bg-green-500'}`}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-yellow-400"
          style={{ left: `${threshPct}%` }}
          title={`Threshold: ${threshold}`}
        />
      </div>
    </div>
  );
}

export default function TestQualityPage() {
  const [results, setResults] = useState<ImageTestResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [autoLoaded, setAutoLoaded] = useState(false);

  const processFileList = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setResults([]);
    setProgress({ current: 0, total: files.length });

    const newResults: ImageTestResult[] = [];

    for (let i = 0; i < files.length; i++) {
      setProgress({ current: i + 1, total: files.length });
      try {
        const result = await processImageFile(files[i]);
        newResults.push(result);
        setResults([...newResults]);
      } catch (err) {
        console.error(`Failed to process ${files[i].name}:`, err);
      }
    }

    setIsProcessing(false);
  }, []);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    await processFileList(Array.from(files));
  }, [processFileList]);

  /** Fetch all testing images from public/testing-images/ and run quality checks */
  const runAutoTest = useCallback(async () => {
    setIsProcessing(true);
    setResults([]);
    setProgress({ current: 0, total: TEST_IMAGE_FILENAMES.length });

    const newResults: ImageTestResult[] = [];

    for (let i = 0; i < TEST_IMAGE_FILENAMES.length; i++) {
      const filename = TEST_IMAGE_FILENAMES[i];
      setProgress({ current: i + 1, total: TEST_IMAGE_FILENAMES.length });

      try {
        const url = `/testing-images/${encodeURIComponent(filename)}`;
        const response = await fetch(url);
        if (!response.ok) {
          console.error(`Failed to fetch ${filename}: ${response.status}`);
          continue;
        }
        const blob = await response.blob();
        const file = new File([blob], filename, { type: blob.type });
        const result = await processImageFile(file);
        newResults.push(result);
        setResults([...newResults]);
      } catch (err) {
        console.error(`Failed to process ${filename}:`, err);
      }
    }

    setIsProcessing(false);
  }, []);

  // Auto-load testing images on page mount
  useEffect(() => {
    if (!autoLoaded) {
      setAutoLoaded(true);
      runAutoTest();
    }
  }, [autoLoaded, runAutoTest]);

  const passed = results.filter((r) => r.quality.passed).length;
  const failed = results.length - passed;

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">
            PeanutGuard Quality Check Tester
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Tests checkImageQuality() from quality-check.ts against real images
            in the browser
          </p>
        </div>

        {/* Controls */}
        <div className="mb-8 flex gap-4">
          <button
            onClick={runAutoTest}
            disabled={isProcessing}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-500 disabled:opacity-50"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
            </svg>
            {isProcessing ? 'Running...' : 'Run All 17 Test Images'}
          </button>

          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-600 bg-gray-900 px-6 py-3 text-sm font-medium text-gray-300 transition hover:border-green-500 hover:bg-gray-800">
            <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Or upload custom images
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
        </div>

        {/* Progress */}
        {isProcessing && (
          <div className="mb-8 rounded-xl bg-gray-900 p-4">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
              <span className="text-sm">
                Processing {progress.current}/{progress.total}...
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-700">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Summary */}
        {results.length > 0 && (
          <div className="mb-8 grid grid-cols-4 gap-4">
            <div className="rounded-xl bg-gray-900 p-4 text-center">
              <div className="text-2xl font-bold">{results.length}</div>
              <div className="text-xs text-gray-400">Total Images</div>
            </div>
            <div className="rounded-xl bg-gray-900 p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{passed}</div>
              <div className="text-xs text-gray-400">Passed</div>
            </div>
            <div className="rounded-xl bg-gray-900 p-4 text-center">
              <div className="text-2xl font-bold text-red-400">{failed}</div>
              <div className="text-xs text-gray-400">Failed</div>
            </div>
            <div className="rounded-xl bg-gray-900 p-4 text-center">
              <div className="text-2xl font-bold">
                {results.length > 0
                  ? `${((passed / results.length) * 100).toFixed(0)}%`
                  : '-'}
              </div>
              <div className="text-xs text-gray-400">Pass Rate</div>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="space-y-4">
          {results.map((r, idx) => (
            <div
              key={idx}
              className={`overflow-hidden rounded-2xl border ${
                r.quality.passed
                  ? 'border-green-500/20 bg-gray-900'
                  : 'border-red-500/20 bg-gray-900'
              }`}
            >
              <div className="flex gap-4 p-4">
                {/* Thumbnail */}
                <div className="flex-shrink-0">
                  <img
                    src={r.thumbnail}
                    alt={r.filename}
                    className="h-28 w-28 rounded-lg border border-gray-700 object-cover"
                  />
                  <div className="mt-1 text-center text-[10px] text-gray-500">
                    {r.originalSize}
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold">{r.filename}</span>
                      <span className="ml-2 text-xs text-gray-500">
                        {r.processingMs.toFixed(0)}ms
                      </span>
                    </div>
                    <StatusBadge passed={r.quality.passed} />
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-4">
                    <MetricBar
                      label="Sharpness (Blur Score)"
                      value={r.quality.blurScore}
                      max={3000}
                      threshold={100}
                      unit=""
                    />
                    <MetricBar
                      label="Brightness"
                      value={r.quality.brightness}
                      max={255}
                      threshold={40}
                      unit=""
                    />
                    <MetricBar
                      label="Leaf Coverage"
                      value={r.quality.leafCoverage * 100}
                      max={100}
                      threshold={30}
                      unit="%"
                    />
                  </div>

                  {/* Issues */}
                  {r.quality.issues.length > 0 && (
                    <div className="space-y-1">
                      {r.quality.issues.map((issue, i) => (
                        <div
                          key={i}
                          className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-300"
                        >
                          {issue}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Suggestions */}
                  {r.quality.suggestions.length > 0 && (
                    <div className="space-y-1">
                      {r.quality.suggestions.map((sug, i) => (
                        <div
                          key={i}
                          className="rounded-lg bg-yellow-500/10 px-3 py-1.5 text-xs text-yellow-300"
                        >
                          {sug}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Augmentation results */}
                  {r.augmentations.length > 0 && (
                    <div>
                      <div className="mb-1 text-xs font-medium text-gray-400">
                        Augmentation Impact (TTA):
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {r.augmentations.map((aug, i) => (
                          <div
                            key={i}
                            className={`rounded-lg px-2 py-1 text-[10px] ${
                              aug.quality.passed
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-red-500/10 text-red-400'
                            }`}
                          >
                            {aug.name}: blur={aug.quality.blurScore.toFixed(0)}{' '}
                            leaf={( aug.quality.leafCoverage * 100).toFixed(0)}%{' '}
                            {aug.quality.passed ? 'PASS' : 'FAIL'}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
