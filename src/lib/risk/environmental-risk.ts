import type { Prediction } from '@/types';
import type { WeatherData, EnvironmentalRisk } from '@/types/desktop';
import envConfig from '@/data/environmental_logic_config.json';

interface TriggerConditions {
  temperature_min_c?: number;
  temperature_max_c?: number;
  humidity_min_pct?: number;
  humidity_max_pct?: number;
  soil_moisture_min?: number;
  soil_moisture_max?: number;
  [key: string]: unknown;
}

interface DiseaseClimateEntry {
  trigger_conditions: TriggerConditions;
  risk_multiplier: number;
  season_peak_months: number[];
}

const diseaseClimate = envConfig.disease_climate_triggers as Record<
  string,
  DiseaseClimateEntry
>;
const modelWeight = envConfig.risk_score_formula.model_weight;
const envWeight = envConfig.risk_score_formula.environmental_weight;

/**
 * Calculate a weather match score (0–1) for a disease given current conditions.
 */
function weatherMatchScore(
  triggers: TriggerConditions,
  weather: WeatherData,
): number {
  const checks: boolean[] = [];

  if (triggers.temperature_min_c != null) {
    checks.push(weather.temperature >= triggers.temperature_min_c);
  }
  if (triggers.temperature_max_c != null) {
    checks.push(weather.temperature <= triggers.temperature_max_c);
  }
  if (triggers.humidity_min_pct != null) {
    checks.push(weather.humidity >= triggers.humidity_min_pct);
  }
  if (triggers.humidity_max_pct != null) {
    checks.push(weather.humidity <= triggers.humidity_max_pct);
  }
  if (triggers.soil_moisture_min != null) {
    checks.push(weather.soilMoisture >= triggers.soil_moisture_min);
  }
  if (triggers.soil_moisture_max != null) {
    checks.push(weather.soilMoisture <= triggers.soil_moisture_max);
  }

  if (checks.length === 0) return 0;

  const matchCount = checks.filter(Boolean).length;
  return matchCount / checks.length;
}

/**
 * Adjust model predictions with environmental Bayesian priors.
 *
 * Formula: finalRisk = (confidence × modelWeight) + (matchScore × riskMultiplier × envWeight)
 * Clamped to [0, 1].
 *
 * If weather is null, returns predictions unchanged (model confidence only).
 */
export function calculateRisk(
  predictions: Prediction[],
  weather: WeatherData | null,
): EnvironmentalRisk[] {
  return predictions.map((pred) => {
    const entry = diseaseClimate[pred.diseaseLabel];

    if (!weather || !entry) {
      return {
        diseaseLabel: pred.diseaseLabel,
        priorProbability: pred.confidence,
        riskMultiplier: 1.0,
        weatherMatch: 0,
        finalRisk: pred.confidence,
      };
    }

    const matchScore = weatherMatchScore(entry.trigger_conditions, weather);
    const multiplier = entry.risk_multiplier;

    const finalRisk = Math.min(
      1,
      Math.max(
        0,
        pred.confidence * modelWeight + matchScore * multiplier * envWeight,
      ),
    );

    return {
      diseaseLabel: pred.diseaseLabel,
      priorProbability: pred.confidence,
      riskMultiplier: multiplier,
      weatherMatch: matchScore,
      finalRisk,
    };
  });
}
