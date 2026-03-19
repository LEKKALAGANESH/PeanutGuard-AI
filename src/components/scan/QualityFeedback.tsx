'use client';

import type { QualityReport, ImageIssue } from '@/types';

interface QualityFeedbackProps {
  report: QualityReport;
  onRetake: () => void;
}

const ISSUE_LABELS: Record<ImageIssue, { label: string; suggestion: string; critical: boolean }> = {
  blur: {
    label: 'Image is too blurry for a 10/10 result',
    suggestion: 'Stabilize your camera — brace elbows against your body, tap to focus on the leaf, and hold still for 1 second before capturing.',
    critical: true,
  },
  dark: {
    label: 'Lighting too low for accurate analysis',
    suggestion: 'Move the peanut leaf into natural daylight. Use your phone\'s flash if in shade, and avoid heavy canopy cover.',
    critical: true,
  },
  overexposed: {
    label: 'Lighting too high — details are washed out',
    suggestion: 'Shield the leaf from direct sunlight with your body\'s shadow, or angle your phone to reduce glare.',
    critical: true,
  },
  not_peanut: {
    label: 'Not a peanut plant',
    suggestion: 'Please photograph peanut leaves, stems, or pods for disease analysis.',
    critical: true,
  },
  partial_leaf: {
    label: 'Move closer! We need a detailed view',
    suggestion: 'Hold your phone 10–20 cm (4–8 inches) from the leaf so it fills most of the frame. Center any visible spots or discoloration.',
    critical: false,
  },
  low_confidence: {
    label: 'Unable to identify clearly',
    suggestion: 'Try retaking with better lighting and sharper focus. Ensure the leaf fills most of the frame.',
    critical: false,
  },
};

export default function QualityFeedback({ report, onRetake }: QualityFeedbackProps) {
  if (report.passed) return null;

  return (
    <div className="mx-auto w-full max-w-sm px-4 sm:max-w-md md:max-w-lg">
      <div className="rounded-2xl bg-gray-900 p-5">
        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
            <svg
              className="h-5 w-5 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Image Quality Issue</h3>
            <p className="text-xs text-gray-400">
              Please retake for accurate results
            </p>
          </div>
        </div>

        {/* Issues List */}
        <div className="mb-5 space-y-3">
          {report.issues.map((issue, index) => {
            const info = ISSUE_LABELS[issue];
            const isCritical = info?.critical ?? true;
            const iconColor = isCritical ? 'text-red-400' : 'text-yellow-400';
            const bgColor = isCritical ? 'bg-red-500/10' : 'bg-yellow-500/10';
            const borderColor = isCritical ? 'border-red-500/20' : 'border-yellow-500/20';

            return (
              <div
                key={index}
                className={`flex items-start gap-3 rounded-xl border ${borderColor} ${bgColor} p-3`}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {isCritical ? (
                    <svg className={`h-5 w-5 ${iconColor}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className={`h-5 w-5 ${iconColor}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zm0-10.5a9 9 0 100 18 9 9 0 000-18z" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{info?.label ?? issue}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{info?.suggestion ?? ''}</p>
                </div>
              </div>
            );
          })}

          {/* Also show raw suggestions from the quality report if any */}
          {report.suggestions.map((suggestion, index) => (
            <div
              key={`suggestion-${index}`}
              className="flex items-start gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3"
            >
              <div className="mt-0.5 flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                </svg>
              </div>
              <p className="text-sm text-gray-300">{suggestion}</p>
            </div>
          ))}
        </div>

        {/* Retake Button */}
        <button
          onClick={onRetake}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white active:bg-green-700"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
          </svg>
          Retake Photo
        </button>
      </div>
    </div>
  );
}
