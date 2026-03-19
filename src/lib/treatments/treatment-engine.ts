import type { Disease, ScanResult, Prediction, DiseaseLibrary } from '@/types';
import diseaseData from '@/data/disease_library.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TreatmentRecommendation {
  disease: Disease;
  prediction: Prediction;
  severityLevel: number;
  severityDescription: string;
  organicTreatments: Disease['treatments']['organic'];
  chemicalTreatments: Disease['treatments']['chemical'];
  culturalPractices: string[];
  yieldImpact: { min: number; max: number };
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const library = diseaseData as unknown as DiseaseLibrary;

/**
 * Calculate urgency level from a 1-5 severity score.
 *
 * 1-2 -> low, 3 -> medium, 4 -> high, 5 -> critical
 */
export function getUrgencyLevel(severity: number): 'low' | 'medium' | 'high' | 'critical' {
  if (severity <= 2) return 'low';
  if (severity === 3) return 'medium';
  if (severity === 4) return 'high';
  return 'critical';
}

/**
 * Look up the localised severity description for a given level.
 * Falls back to English ('en') if the requested locale is unavailable,
 * then falls back to an empty string.
 */
function getSeverityDescription(
  disease: Disease,
  level: number,
  locale: string,
): string {
  const key = String(level);
  const descriptions = disease.severity_descriptions?.[key];
  if (!descriptions) return '';
  return descriptions[locale] ?? descriptions['en'] ?? '';
}

/**
 * Find a disease entry whose label matches a prediction label.
 * Comparison is case-insensitive.
 */
function findDisease(label: string): Disease | undefined {
  const normalised = label.toLowerCase();
  return library.diseases.find((d) => d.label.toLowerCase() === normalised);
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Map scan results to actionable treatment recommendations.
 *
 * - Matches each prediction to a disease in the bundled library.
 * - Filters out chemical treatments that are banned in the user's region.
 * - Resolves cultural-practice strings to the user's locale (fallback: 'en').
 * - Returns results sorted by prediction confidence (highest first).
 */
export function getRecommendations(
  scanResult: ScanResult,
  locale: string,
  region: string,
): TreatmentRecommendation[] {
  const regionLower = region.toLowerCase();

  const recommendations: TreatmentRecommendation[] = [];

  for (const prediction of scanResult.predictions) {
    const disease = findDisease(prediction.diseaseLabel);
    if (!disease) continue;

    // Filter chemicals: exclude any banned in the user's region
    const safeChemicals = disease.treatments.chemical.filter((chem) => {
      if (!chem.banned_in || chem.banned_in.length === 0) return true;
      return !chem.banned_in.some((b) => b.toLowerCase() === regionLower);
    });

    // Resolve cultural practices to the requested locale
    const culturalPractices = disease.treatments.cultural.map((entry) => {
      return entry[locale] ?? entry['en'] ?? Object.values(entry)[0] ?? '';
    });

    const severityLevel = scanResult.severityScore;
    const severityDescription = getSeverityDescription(disease, severityLevel, locale);

    recommendations.push({
      disease,
      prediction,
      severityLevel,
      severityDescription,
      organicTreatments: disease.treatments.organic,
      chemicalTreatments: safeChemicals,
      culturalPractices,
      yieldImpact: {
        min: disease.yield_impact.min_pct,
        max: disease.yield_impact.max_pct,
      },
      urgency: getUrgencyLevel(severityLevel),
    });
  }

  // Sort by confidence descending
  recommendations.sort((a, b) => b.prediction.confidence - a.prediction.confidence);

  return recommendations;
}

/**
 * Get the urgency color class for a given urgency level.
 * Returns Tailwind-compatible color tokens.
 */
export function getUrgencyColor(urgency: 'low' | 'medium' | 'high' | 'critical'): {
  bg: string;
  text: string;
  border: string;
} {
  switch (urgency) {
    case 'low':
      return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' };
    case 'medium':
      return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' };
    case 'high':
      return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' };
    case 'critical':
      return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' };
  }
}

/**
 * Get confusion pair warnings for a disease prediction.
 * Returns diseases that are visually similar and may be misidentified,
 * along with differentiating tips.
 */
export function getConfusionWarnings(
  diseaseLabel: string,
  locale: string,
): { confusedWith: string; diseaseName: string }[] {
  const disease = findDisease(diseaseLabel);
  if (!disease || !disease.confusion_pairs || disease.confusion_pairs.length === 0) {
    return [];
  }

  return disease.confusion_pairs.map((pairLabel) => {
    const pairDisease = findDisease(pairLabel);
    const name = pairDisease
      ? (pairDisease.name[locale] ?? pairDisease.name['en'] ?? pairLabel)
      : pairLabel;
    return { confusedWith: pairLabel, diseaseName: name };
  });
}

/**
 * Get the rescan interval in days based on severity.
 * Higher severity = more frequent rescans.
 */
export function getRescanIntervalDays(severity: number): number {
  if (severity >= 5) return 3;
  if (severity >= 4) return 5;
  if (severity >= 3) return 7;
  if (severity >= 2) return 10;
  return 14;
}

/**
 * Format brand recommendations for a specific region.
 * Returns a display string with available brands, or a fallback message.
 */
export function formatBrandsForRegion(
  treatment: { brands_by_region: Record<string, string[]> },
  region: string,
): string {
  const brands = treatment.brands_by_region[region.toUpperCase()];
  if (brands && brands.length > 0) {
    return brands.join(', ');
  }
  // Fallback to any region that has brands
  for (const [, regionBrands] of Object.entries(treatment.brands_by_region)) {
    if (regionBrands.length > 0) {
      return regionBrands.join(', ') + ' (check local availability)';
    }
  }
  return 'Contact local agri-dealer for availability';
}
