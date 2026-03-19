'use client';

import type { TreatmentRecommendation } from '@/lib/treatments/treatment-engine';
import { formatBrandsForRegion } from '@/lib/treatments/treatment-engine';
import type { Treatment } from '@/types';

// ---------------------------------------------------------------------------
// TreatmentAccordion
// ---------------------------------------------------------------------------
// Three collapsible sections (Organic, Chemical, Cultural) built on native
// <details>/<summary> for zero-JS, accessible accordion behaviour.
// ---------------------------------------------------------------------------

interface TreatmentAccordionProps {
  recommendation: TreatmentRecommendation;
  locale: string;
  region: string;
}

// ---------------------------------------------------------------------------
// Urgency badge colours
// ---------------------------------------------------------------------------

const URGENCY_STYLES: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800 animate-pulse',
};

const URGENCY_LABELS: Record<string, string> = {
  low: 'Low Urgency',
  medium: 'Medium Urgency',
  high: 'High Urgency',
  critical: 'Critical — Act Now',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TreatmentItem({
  treatment,
  locale,
  region,
  showBannedWarning,
}: {
  treatment: Treatment;
  locale: string;
  region: string;
  showBannedWarning?: boolean;
}) {
  const name = treatment.name[locale] ?? treatment.name['en'] ?? Object.values(treatment.name)[0] ?? 'Unknown';
  const brandsText = formatBrandsForRegion(treatment, region);
  const brands = treatment.brands_by_region?.[region] ?? [];

  // Check if this chemical is banned in the EU (for informational warning)
  const isBannedInEU =
    showBannedWarning && treatment.banned_in?.some((r) => r.toLowerCase() === 'eu');

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">{name}</p>
        {isBannedInEU && (
          <span className="shrink-0 rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
            Banned in EU
          </span>
        )}
      </div>

      {treatment.active_ingredient && (
        <p className="mt-0.5 text-xs text-gray-500">
          Active ingredient: {treatment.active_ingredient}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        <span>
          <span className="font-medium">Dosage:</span> {treatment.dosage}
        </span>
        <span>
          <span className="font-medium">Frequency:</span> {treatment.frequency}
        </span>
      </div>

      <p className="mt-2 text-xs text-gray-500">
        <span className="font-medium">Available brands:</span> {brands.length > 0 ? brands.join(', ') : brandsText}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function TreatmentAccordion({
  recommendation,
  locale,
  region,
}: TreatmentAccordionProps) {
  const {
    urgency,
    organicTreatments,
    chemicalTreatments,
    culturalPractices,
  } = recommendation;

  return (
    <div className="space-y-3">
      {/* Urgency badge */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${URGENCY_STYLES[urgency]}`}
        >
          {URGENCY_LABELS[urgency]}
        </span>
      </div>

      {/* Organic / Natural — open by default */}
      <details open className="group rounded-xl border border-gray-200 bg-white">
        <summary className="flex min-h-[48px] cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-green-700 select-none">
          <span>Organic / Natural</span>
          <ChevronIcon />
        </summary>
        <div className="space-y-2 px-4 pb-4">
          {organicTreatments.length === 0 ? (
            <p className="text-sm text-gray-400">No organic treatments available.</p>
          ) : (
            organicTreatments.map((t, idx) => (
              <TreatmentItem
                key={idx}
                treatment={t}
                locale={locale}
                region={region}
              />
            ))
          )}
        </div>
      </details>

      {/* Chemical */}
      <details className="group rounded-xl border border-gray-200 bg-white">
        <summary className="flex min-h-[48px] cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 select-none">
          <span>Chemical</span>
          <ChevronIcon />
        </summary>
        <div className="space-y-2 px-4 pb-4">
          {chemicalTreatments.length === 0 ? (
            <p className="text-sm text-gray-400">
              No chemical treatments available for your region.
            </p>
          ) : (
            chemicalTreatments.map((t, idx) => (
              <TreatmentItem
                key={idx}
                treatment={t}
                locale={locale}
                region={region}
                showBannedWarning
              />
            ))
          )}
        </div>
      </details>

      {/* Cultural Practices */}
      <details className="group rounded-xl border border-gray-200 bg-white">
        <summary className="flex min-h-[48px] cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 select-none">
          <span>Cultural Practices</span>
          <ChevronIcon />
        </summary>
        <div className="space-y-2 px-4 pb-4">
          {culturalPractices.length === 0 ? (
            <p className="text-sm text-gray-400">No cultural practices listed.</p>
          ) : (
            <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
              {culturalPractices.map((practice, idx) => (
                <li key={idx}>{practice}</li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chevron icon (rotates when <details> is open)
// ---------------------------------------------------------------------------

function ChevronIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}
