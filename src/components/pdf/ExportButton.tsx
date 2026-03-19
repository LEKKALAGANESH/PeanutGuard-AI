'use client';

import { useState, useCallback } from 'react';
import type { ScanResult } from '@/types';
import type { TreatmentRecommendation } from '@/lib/treatments/treatment-engine';
import { downloadReport } from '@/lib/pdf/report-generator';
import type { ReportData } from '@/lib/pdf/report-generator';

interface ExportButtonProps {
  scanResult: ScanResult;
  recommendations: TreatmentRecommendation[];
  fieldName?: string;
  gpsCoords?: { lat: number; lng: number };
  locale?: string;
  region?: string;
  className?: string;
}

type ButtonState = 'idle' | 'generating' | 'success' | 'error';

export default function ExportButton({
  scanResult,
  recommendations,
  fieldName,
  gpsCoords,
  locale = 'en-IN',
  region = 'India',
  className = '',
}: ExportButtonProps) {
  const [state, setState] = useState<ButtonState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleExport = useCallback(async () => {
    if (state === 'generating') return;

    setState('generating');
    setErrorMessage('');

    try {
      const reportData: ReportData = {
        scanResult,
        recommendations,
        fieldName,
        gpsCoords,
        locale,
        region,
      };

      await downloadReport(reportData);
      setState('success');

      // Reset to idle after showing success
      setTimeout(() => {
        setState('idle');
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate report';
      setErrorMessage(message);
      setState('error');

      // Reset to idle after showing error
      setTimeout(() => {
        setState('idle');
        setErrorMessage('');
      }, 3000);
    }
  }, [scanResult, recommendations, fieldName, gpsCoords, locale, region, state]);

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <button
        type="button"
        onClick={handleExport}
        disabled={state === 'generating'}
        aria-label="Download PDF report"
        className={`
          inline-flex items-center gap-2 px-5 py-3 rounded-xl
          text-sm font-semibold text-white
          transition-all duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500
          disabled:cursor-not-allowed
          ${state === 'idle' ? 'bg-green-600 hover:bg-green-700 active:bg-green-800 shadow-md hover:shadow-lg' : ''}
          ${state === 'generating' ? 'bg-green-500 opacity-80' : ''}
          ${state === 'success' ? 'bg-green-700' : ''}
          ${state === 'error' ? 'bg-red-600' : ''}
        `}
      >
        {state === 'idle' && (
          <>
            <DownloadIcon />
            <span>Export PDF Report</span>
          </>
        )}

        {state === 'generating' && (
          <>
            <SpinnerIcon />
            <span>Generating...</span>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckIcon />
            <span>Downloaded!</span>
          </>
        )}

        {state === 'error' && (
          <>
            <ErrorIcon />
            <span>Failed</span>
          </>
        )}
      </button>

      {errorMessage && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="animate-spin"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}
