'use client';

// ---------------------------------------------------------------------------
// SeverityMeter
// ---------------------------------------------------------------------------
// Displays 5 circles filled up to the given severity level (1-5).
// Each filled circle uses a colour that intensifies with severity.
// ---------------------------------------------------------------------------

interface SeverityMeterProps {
  /** Severity level, 1 (mild) through 5 (critical). */
  level: number;
  /** Optional description text shown below the circles. */
  description?: string;
}

/** Tailwind background classes per severity position (1-indexed). */
const FILL_COLORS: Record<number, string> = {
  1: 'bg-green-400',
  2: 'bg-yellow-400',
  3: 'bg-orange-400',
  4: 'bg-red-500',
  5: 'bg-red-700',
};

export default function SeverityMeter({ level, description }: SeverityMeterProps) {
  const clamped = Math.max(1, Math.min(5, Math.round(level)));

  return (
    <div
      className="flex flex-col items-start gap-1.5"
      role="img"
      aria-label={`Severity level ${clamped} out of 5${description ? `: ${description}` : ''}`}
    >
      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, i) => {
          const pos = i + 1;
          const isFilled = pos <= clamped;
          return (
            <span
              key={pos}
              className={`inline-block h-4 w-4 rounded-full border-2 ${
                isFilled
                  ? `${FILL_COLORS[pos]} border-transparent`
                  : 'border-gray-300 bg-transparent'
              }`}
            />
          );
        })}
      </div>

      {description && (
        <p className="text-xs leading-tight text-gray-600">{description}</p>
      )}
    </div>
  );
}
