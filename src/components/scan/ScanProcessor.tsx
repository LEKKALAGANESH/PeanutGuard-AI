'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ScanResult, QualityReport } from '@/types';
import QualityFeedback from '@/components/scan/QualityFeedback';

interface ScanProcessorProps {
  file: File;
  onResult: (result: ScanResult) => void;
  onRetake: () => void;
}

type StepStatus = 'pending' | 'processing' | 'done' | 'failed';

interface ProcessingStep {
  label: string;
  status: StepStatus;
}

const MOCK_RESULT: ScanResult = {
  id: crypto.randomUUID(),
  timestamp: Date.now(),
  imageDataUrl: '',
  predictions: [
    { diseaseLabel: 'early_leaf_spot', confidence: 0.87 },
    { diseaseLabel: 'late_leaf_spot', confidence: 0.08 },
    { diseaseLabel: 'healthy', confidence: 0.03 },
  ],
  lesions: [
    { x: 50, y: 80, width: 60, height: 55, confidence: 0.92 },
    { x: 150, y: 120, width: 45, height: 40, confidence: 0.85 },
  ],
  severityScore: 3,
  modelUsed: 'mobilenetv3_large',
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ScanProcessor({ file, onResult, onRetake }: ScanProcessorProps) {
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { label: 'Checking image quality...', status: 'pending' },
    { label: 'Verifying peanut crop...', status: 'pending' },
    { label: 'Analyzing disease...', status: 'pending' },
    { label: 'Detecting lesions...', status: 'pending' },
  ]);

  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);
  const [peanutGateFailed, setPeanutGateFailed] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [uncertainResult, setUncertainResult] = useState(false);

  const updateStep = useCallback((index: number, status: StepStatus) => {
    setSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, status } : step))
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function runPipeline() {
      const imageDataUrl = await fileToDataUrl(file);

      // Pre-check: verify ONNX models are available
      try {
        const { checkModelsAvailable } = await import('@/lib/ai');
        const modelsReady = await checkModelsAvailable();
        if (!modelsReady) {
          setIsDemo(true);
        }
      } catch {
        setIsDemo(true);
      }

      // Step 1: Check image quality via preprocessing pipeline
      updateStep(0, 'processing');
      let preprocessed: { tensor: Float32Array; thumbnail: string; qualityReport: { passed: boolean; blurScore: number; brightness: number; leafCoverage: number; plantTissueCoverage: number; issues: string[]; suggestions: string[] } } | null = null;
      try {
        const { preprocessImage } = await import('@/lib/preprocessing/preprocess');
        preprocessed = await preprocessImage(file);

        if (cancelled) return;

        if (!preprocessed.qualityReport.passed) {
          updateStep(0, 'failed');
          // Map QualityCheckResult issues (full sentences) to ImageIssue enum
          const issueTypes: import('@/types').ImageIssue[] = [];
          for (const msg of preprocessed.qualityReport.issues) {
            const lower = msg.toLowerCase();
            if (lower.includes('blurry') || lower.includes('blur')) issueTypes.push('blur');
            else if (lower.includes('lighting too low') || lower.includes('too dark')) issueTypes.push('dark');
            else if (lower.includes('lighting too high') || lower.includes('overexposed')) issueTypes.push('overexposed');
            else if (lower.includes('move closer') || lower.includes('leaf coverage') || lower.includes('plant tissue')) issueTypes.push('partial_leaf');
          }
          const mapped: QualityReport = {
            passed: false,
            blurScore: preprocessed.qualityReport.blurScore,
            brightness: preprocessed.qualityReport.brightness,
            issues: issueTypes,
            suggestions: preprocessed.qualityReport.suggestions,
          };
          setQualityReport(mapped);
          return;
        }
        updateStep(0, 'done');
      } catch {
        if (cancelled) return;
        // Module not available yet - skip quality check in demo mode
        setIsDemo(true);
        updateStep(0, 'done');
      }

      // Step 2: Verify peanut crop
      updateStep(1, 'processing');
      try {
        const { runPeanutGate } = await import('@/lib/ai');
        const isPeanut = await runPeanutGate(file);

        if (cancelled) return;

        if (!isPeanut) {
          updateStep(1, 'failed');
          setPeanutGateFailed(true);
          return;
        }
        updateStep(1, 'done');
      } catch {
        if (cancelled) return;
        setIsDemo(true);
        updateStep(1, 'done');
      }

      // Step 3: Analyze disease
      updateStep(2, 'processing');
      let predictions = MOCK_RESULT.predictions;
      let modelUsed = MOCK_RESULT.modelUsed;
      try {
        const { classifyDisease } = await import('@/lib/ai');
        const result = await classifyDisease(file);

        if (cancelled) return;

        predictions = result.predictions;
        modelUsed = result.modelUsed;

        // Check confidence
        if (predictions[0] && predictions[0].confidence < 0.6) {
          setUncertainResult(true);
        }

        updateStep(2, 'done');
      } catch {
        if (cancelled) return;
        setIsDemo(true);
        predictions = MOCK_RESULT.predictions;

        // Simulate processing delay for demo
        await new Promise((r) => setTimeout(r, 800));
        if (cancelled) return;
        updateStep(2, 'done');
      }

      // Step 4: Detect lesions
      updateStep(3, 'processing');
      let lesions = MOCK_RESULT.lesions;
      let severityScore = MOCK_RESULT.severityScore;
      try {
        const { detectLesions } = await import('@/lib/ai');
        const detection = await detectLesions(file);

        if (cancelled) return;

        lesions = detection.lesions;
        severityScore = detection.severityScore;
        updateStep(3, 'done');
      } catch {
        if (cancelled) return;
        setIsDemo(true);
        lesions = MOCK_RESULT.lesions;
        severityScore = MOCK_RESULT.severityScore;

        await new Promise((r) => setTimeout(r, 600));
        if (cancelled) return;
        updateStep(3, 'done');
      }

      // Build final result
      const scanResult: ScanResult = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        imageDataUrl: preprocessed?.thumbnail || imageDataUrl,
        predictions,
        lesions,
        severityScore,
        modelUsed,
      };

      // Small delay so user sees all steps completed
      await new Promise((r) => setTimeout(r, 400));
      if (cancelled) return;

      onResult(scanResult);
    }

    runPipeline();

    return () => {
      cancelled = true;
    };
  }, [file, onResult, updateStep]);

  // Quality check failed
  if (qualityReport && !qualityReport.passed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4">
        <QualityFeedback report={qualityReport} onRetake={onRetake} />
      </div>
    );
  }

  // Peanut gate failed
  if (peanutGateFailed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4">
        <div className="mx-auto w-full max-w-sm rounded-2xl bg-gray-900 p-6 text-center sm:max-w-md md:max-w-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/20">
            <svg
              className="h-8 w-8 text-orange-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>

          <h3 className="mb-2 text-lg font-semibold text-white">
            Not a Peanut Plant
          </h3>
          <p className="mb-6 text-sm text-gray-400">
            The image doesn&apos;t appear to contain a peanut plant. Please take a
            photo of a peanut leaf or plant for disease analysis.
          </p>

          <button
            onClick={onRetake}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white active:bg-green-700"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
              />
            </svg>
            Retake Photo
          </button>
        </div>
      </div>
    );
  }

  // Processing view
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4">
      <div className="mx-auto w-full max-w-sm sm:max-w-md md:max-w-lg">
        {/* Demo badge */}
        {isDemo && (
          <div className="mb-4 flex justify-center">
            <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-medium text-yellow-400">
              [Demo Mode]
            </span>
          </div>
        )}

        {/* Uncertainty warning */}
        {uncertainResult && (
          <div className="mb-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-center">
            <p className="text-sm text-yellow-400">
              Results uncertain &mdash; consider retaking with better lighting
            </p>
          </div>
        )}

        {/* Processing header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-600/20">
            <svg
              className="h-8 w-8 animate-pulse text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">Analyzing Your Crop</h2>
          <p className="mt-1 text-sm text-gray-400">
            All processing happens on your device
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-xl bg-gray-900 px-4 py-3"
            >
              {/* Status icon */}
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
                {step.status === 'pending' && (
                  <div className="h-3 w-3 rounded-full bg-gray-600" />
                )}
                {step.status === 'processing' && (
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
                )}
                {step.status === 'done' && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600">
                    <svg
                      className="h-4 w-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                  </div>
                )}
                {step.status === 'failed' && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600">
                    <svg
                      className="h-4 w-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </div>
                )}
              </div>

              {/* Label */}
              <span
                className={`text-sm ${
                  step.status === 'pending'
                    ? 'text-gray-500'
                    : step.status === 'processing'
                      ? 'font-medium text-white'
                      : step.status === 'done'
                        ? 'text-gray-300'
                        : 'text-red-400'
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
