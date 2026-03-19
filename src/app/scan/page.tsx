'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CameraCapture from '@/components/scan/CameraCapture';
import ScanProcessor from '@/components/scan/ScanProcessor';
import { useScanStore } from '@/stores/scan-store';
import type { ScanResult } from '@/types';

type ScanPhase = 'camera' | 'processing' | 'complete';

export default function ScanPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<ScanPhase>('camera');
  const [capturedFile, setCapturedFile] = useState<File | null>(null);

  // Release ONNX model memory when leaving the scan page
  useEffect(() => {
    return () => {
      import('@/lib/ai').then(({ disposeModels }) => {
        disposeModels().catch(() => {});
      }).catch(() => {});
    };
  }, []);

  const handleCapture = useCallback((file: File) => {
    setCapturedFile(file);
    setPhase('processing');
  }, []);

  const handleCameraError = useCallback((error: string) => {
    console.warn('Camera error:', error);
  }, []);

  const handleResult = useCallback(
    (result: ScanResult) => {
      setPhase('complete');

      useScanStore.getState().setCurrentResult(result);

      router.push('/scan/result');
    },
    [router]
  );

  const handleRetake = useCallback(() => {
    setCapturedFile(null);
    setPhase('camera');
  }, []);

  const handleBack = useCallback(() => {
    router.push('/');
  }, [router]);

  return (
    <div className="relative min-h-screen bg-gray-950">
      {/* Back button - visible in camera phase */}
      {phase === 'camera' && (
        <button
          onClick={handleBack}
          className="absolute left-4 top-4 z-50 flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-black/40 backdrop-blur-sm active:bg-black/60"
          aria-label="Go back"
        >
          <svg
            className="h-6 w-6 text-white"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </button>
      )}

      {/* Camera Phase */}
      {phase === 'camera' && (
        <CameraCapture onCapture={handleCapture} onError={handleCameraError} />
      )}

      {/* Processing Phase */}
      {phase === 'processing' && capturedFile && (
        <ScanProcessor
          file={capturedFile}
          onResult={handleResult}
          onRetake={handleRetake}
        />
      )}

      {/* Complete Phase - brief transition state */}
      {phase === 'complete' && (
        <div className="flex min-h-screen items-center justify-center bg-gray-950">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600">
              <svg
                className="h-8 w-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-300">
              Analysis complete! Loading results...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
