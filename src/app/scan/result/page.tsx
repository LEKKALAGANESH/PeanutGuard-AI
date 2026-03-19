'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useScanStore } from '@/stores/scan-store';
import { getRecommendations } from '@/lib/treatments/treatment-engine';
import type { TreatmentRecommendation } from '@/lib/treatments/treatment-engine';
import ResultCard from '@/components/results/ResultCard';
import TreatmentAccordion from '@/components/results/TreatmentAccordion';
import ExportButton from '@/components/pdf/ExportButton';
import { getConfusionWarnings, getRescanIntervalDays } from '@/lib/treatments/treatment-engine';
import { useUserStore } from '@/stores/user-store';

/** Minimum confidence threshold for showing secondary disease cards. */
const SECONDARY_CONFIDENCE_THRESHOLD = 0.4;

export default function ScanResultPage() {
  const router = useRouter();
  const result = useScanStore((s) => s.currentResult);
  const isDemo = useScanStore((s) => s.isDemo);
  const locale = useUserStore((s) => s.language);
  const region = useUserStore((s) => s.region);

  // Redirect if there's no result to display
  useEffect(() => {
    if (!result) {
      router.replace('/scan');
    }
  }, [result, router]);

  // Build treatment recommendations from the scan result
  const recommendations: TreatmentRecommendation[] = useMemo(() => {
    if (!result) return [];
    return getRecommendations(result, locale, region);
  }, [result, locale, region]);

  // Auto-create harvest tracking entry when scan has a field assignment
  useEffect(() => {
    if (!result || !result.fieldId || isDemo) return;
    (async () => {
      try {
        const { harvestRepository, calculateDiseasePressure } = await import('@/lib/db/harvest-repository');
        const { scanRepository } = await import('@/lib/db/scan-repository');
        // Get recent scans for this field to compute disease pressure
        const fieldScans = await scanRepository.getByField(result.fieldId!);
        const severities = fieldScans.map((s) => s.severityScore);
        const pressure = calculateDiseasePressure(severities);
        const healthScore = result.predictions[0]?.diseaseLabel === 'healthy'
          ? 100
          : Math.max(0, Math.round((1 - (result.severityScore / 5)) * 100));

        await harvestRepository.save({
          id: crypto.randomUUID(),
          fieldId: result.fieldId!,
          scanId: result.id,
          healthScore,
          diseasePressureIndex: pressure,
          estimatedDaysToHarvest: 0, // requires planting date — computed on harvest page
          readinessScore: 0,
          recordedAt: Date.now(),
        });
      } catch {
        // Harvest tracking is non-critical
      }
    })();
  }, [result, isDemo]);

  // Nothing to render while redirecting
  if (!result) return null;

  // Primary = highest confidence (first after sort); secondary = rest above threshold
  const primary = recommendations[0] as TreatmentRecommendation | undefined;
  const secondary = recommendations
    .slice(1)
    .filter((r) => r.prediction.confidence >= SECONDARY_CONFIDENCE_THRESHOLD);

  function handleNewScan() {
    useScanStore.getState().resetScan();
    router.push('/scan');
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <main className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-green-600 px-4 py-3 shadow-sm">
        <h1 className="text-center text-lg font-bold text-white">Scan Results</h1>
      </header>

      <div className="mx-auto max-w-lg space-y-6 px-4 pt-4 sm:max-w-xl md:max-w-2xl md:px-6">
        {/* Primary Result Card */}
        {primary && (
          <ResultCard
            imageDataUrl={result.imageDataUrl}
            diseaseName={
              primary.disease.name[locale] ??
              primary.disease.name['en'] ??
              primary.disease.label
            }
            scientificName={primary.disease.scientific_name}
            confidence={primary.prediction.confidence}
            severityScore={primary.severityLevel}
            severityDescription={primary.severityDescription}
            lesions={result.lesions}
            isDemo={isDemo}
          />
        )}

        {/* Yield impact warning */}
        {primary && (primary.yieldImpact.min > 0 || primary.yieldImpact.max > 0) && (
          <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
            <svg
              className="mt-0.5 h-5 w-5 shrink-0 text-orange-500"
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
            <div>
              <p className="text-sm font-semibold text-orange-800">
                Potential yield loss: {primary.yieldImpact.min}% &ndash;{' '}
                {primary.yieldImpact.max}%
              </p>
              <p className="mt-0.5 text-xs text-orange-600">
                Based on detected disease and current severity. Early treatment can reduce losses.
              </p>
            </div>
          </div>
        )}

        {/* Treatment recommendations for primary disease */}
        {primary && (
          <section>
            <h2 className="mb-3 text-base font-bold text-gray-900">
              Treatment Recommendations
            </h2>
            <TreatmentAccordion
              recommendation={primary}
              locale={locale}
              region={region}
            />
          </section>
        )}

        {/* Secondary detections */}
        {secondary.length > 0 && (
          <section>
            <h2 className="mb-3 text-base font-bold text-gray-900">
              Other Possible Diseases
            </h2>
            <div className="space-y-4">
              {secondary.map((rec) => (
                <ResultCard
                  key={rec.disease.label}
                  imageDataUrl={result.imageDataUrl}
                  diseaseName={
                    rec.disease.name[locale] ??
                    rec.disease.name['en'] ??
                    rec.disease.label
                  }
                  scientificName={rec.disease.scientific_name}
                  confidence={rec.prediction.confidence}
                  severityScore={rec.severityLevel}
                  severityDescription={rec.severityDescription}
                  lesions={[]}
                />
              ))}
            </div>
          </section>
        )}

        {/* Confusion pair warnings */}
        {primary && (() => {
          const warnings = getConfusionWarnings(primary.disease.label, locale);
          if (warnings.length === 0) return null;
          return (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-800">
                Similar diseases to watch for:
              </p>
              <ul className="mt-1 list-inside list-disc text-xs text-blue-700">
                {warnings.map((w) => (
                  <li key={w.confusedWith}>{w.diseaseName}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-blue-600">
                If uncertain, consult a local agronomist for confirmation.
              </p>
            </div>
          );
        })()}

        {/* Rescan interval recommendation */}
        {primary && (
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Rescan in {getRescanIntervalDays(primary.severityLevel)} days
                </p>
                <p className="text-xs text-gray-500">
                  Track disease progress and evaluate treatment effectiveness
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No disease matched — fallback message */}
        {!primary && (
          <div className="rounded-xl bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-gray-500">
              No matching disease was found in the library. Please try scanning again
              with a clearer image.
            </p>
          </div>
        )}
      </div>

      {/* Sticky action buttons */}
      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white px-4 pb-6 pt-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex max-w-lg gap-3 sm:max-w-xl md:max-w-2xl">
          <ExportButton
            scanResult={result}
            recommendations={recommendations}
            locale={locale}
            region={region}
            className="flex-1"
          />

          <button
            onClick={handleNewScan}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 active:bg-gray-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            New Scan
          </button>
        </div>
      </div>
    </main>
  );
}
