"use client";

import { useState, useCallback } from 'react';
import { useScanStore } from '@/stores/scan-store';
import { scanRepository } from '@/lib/db/scan-repository';
import type { QualityReport, ScanResult } from '@/types';

type ScanPhase =
  | 'idle'
  | 'preprocessing'
  | 'gate'
  | 'classifying'
  | 'detecting'
  | 'complete'
  | 'error';

interface UseScanReturn {
  scanPhase: ScanPhase;
  qualityReport: QualityReport | null;
  result: ScanResult | null;
  error: string | null;
  isDemo: boolean;
  startScan: (file: File) => Promise<void>;
  resetScan: () => void;
}

function createDemoResult(imageDataUrl: string): ScanResult {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    imageDataUrl,
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
}

export function useScan(): UseScanReturn {
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle');
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const store = useScanStore();

  const resetScan = useCallback(() => {
    setScanPhase('idle');
    setQualityReport(null);
    setResult(null);
    setError(null);
    setIsDemo(false);
    store.resetScan();
  }, [store]);

  const startScan = useCallback(
    async (file: File) => {
      setError(null);
      setIsDemo(false);
      setResult(null);
      setQualityReport(null);

      // Read file as data URL for thumbnail
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      try {
        // Phase 1: Preprocessing + quality check
        setScanPhase('preprocessing');
        store.setScanPhase('preprocessing');

        const { preprocessImage } = await import('@/lib/preprocessing/preprocess');
        const preprocessed = await preprocessImage(file);

        // Map full-sentence issues from QualityCheckResult to ImageIssue enum
        const issueTypes: import('@/types').ImageIssue[] = [];
        for (const msg of preprocessed.qualityReport.issues) {
          const lower = msg.toLowerCase();
          if (lower.includes('blurry') || lower.includes('blur')) issueTypes.push('blur');
          else if (lower.includes('lighting too low') || lower.includes('too dark')) issueTypes.push('dark');
          else if (lower.includes('lighting too high') || lower.includes('overexposed')) issueTypes.push('overexposed');
          else if (lower.includes('move closer') || lower.includes('leaf coverage') || lower.includes('plant tissue')) issueTypes.push('partial_leaf');
        }

        const report: QualityReport = {
          passed: preprocessed.qualityReport.passed,
          blurScore: preprocessed.qualityReport.blurScore,
          brightness: preprocessed.qualityReport.brightness,
          issues: issueTypes,
          suggestions: preprocessed.qualityReport.suggestions,
        };
        setQualityReport(report);

        if (!report.passed) {
          setError('Image quality too low. Please retake.');
          setScanPhase('error');
          store.setScanPhase('error');
          return;
        }

        // Phase 2: Peanut gate
        setScanPhase('gate');
        store.setScanPhase('gate');

        const { runPeanutGate } = await import('@/lib/ai');
        const isPeanut = await runPeanutGate(file);

        if (!isPeanut) {
          setError('This does not appear to be a peanut plant.');
          setScanPhase('error');
          store.setScanPhase('error');
          return;
        }

        // Phase 3: Disease classification
        setScanPhase('classifying');
        store.setScanPhase('classifying');

        const { classifyDisease } = await import('@/lib/ai');
        let classification = await classifyDisease(file);

        // Self-healing: retry with aggressive preprocessing if confidence < 0.3
        if (
          classification.predictions.length > 0 &&
          classification.predictions[0].confidence < 0.3
        ) {
          try {
            const { aggressivePreprocess } = await import('@/lib/preprocessing/preprocess');
            const enhanced = await aggressivePreprocess(file);
            const retryClassification = await classifyDisease(
              new File([await (await fetch(enhanced.thumbnail)).blob()], file.name, { type: file.type })
            );
            // Use retry only if it improved confidence
            if (
              retryClassification.predictions.length > 0 &&
              retryClassification.predictions[0].confidence > classification.predictions[0].confidence
            ) {
              classification = retryClassification;
            }
          } catch {
            // Aggressive preprocess retry failed — continue with original result
          }
        }

        // Phase 4: Lesion detection
        setScanPhase('detecting');
        store.setScanPhase('detecting');

        const { detectLesions } = await import('@/lib/ai');
        const detection = await detectLesions(file);

        // Build result
        const scanResult: ScanResult = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          imageDataUrl: preprocessed.thumbnail || imageDataUrl,
          predictions: classification.predictions,
          lesions: detection.lesions,
          severityScore: detection.severityScore,
          modelUsed: classification.modelUsed,
        };

        setResult(scanResult);
        store.setCurrentResult(scanResult);
        setScanPhase('complete');
        store.setScanPhase('complete');

        // Save to IndexedDB + queue for cloud sync
        try {
          await scanRepository.save(scanResult);
          // Queue metadata for background cloud sync
          const { enqueueSyncAction } = await import('@/lib/sync/offline-queue');
          await enqueueSyncAction({
            type: 'upload_scan',
            payload: {
              scanId: scanResult.id,
              diseaseLabel: scanResult.predictions[0]?.diseaseLabel,
              confidence: scanResult.predictions[0]?.confidence,
              severity: scanResult.severityScore,
              modelUsed: scanResult.modelUsed,
              timestamp: scanResult.timestamp,
            },
          });
        } catch {
          // IndexedDB save or sync enqueue failure is non-critical
        }
      } catch (err) {
        // AI pipeline failed — fall back to demo mode with error logging
        if (typeof console !== 'undefined') {
          console.warn(
            '[PeanutGuard] AI pipeline unavailable, using demo mode:',
            err instanceof Error ? err.message : String(err)
          );
        }
        setIsDemo(true);
        store.setIsDemo(true);

        const demoResult = createDemoResult(imageDataUrl);
        setResult(demoResult);
        store.setCurrentResult(demoResult);
        setScanPhase('complete');
        store.setScanPhase('complete');
      }
    },
    [store]
  );

  return {
    scanPhase,
    qualityReport,
    result,
    error,
    isDemo,
    startScan,
    resetScan,
  };
}
