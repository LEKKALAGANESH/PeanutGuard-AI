'use client';

import { useRef, useEffect } from 'react';
import SeverityMeter from '@/components/results/SeverityMeter';

// ---------------------------------------------------------------------------
// ResultCard
// ---------------------------------------------------------------------------
// Displays the scanned image with lesion bounding-box overlay, disease name,
// confidence bar, severity indicator, and optional demo badge.
// ---------------------------------------------------------------------------

interface ResultCardProps {
  imageDataUrl: string;
  diseaseName: string;
  scientificName: string;
  /** 0-1 probability */
  confidence: number;
  /** 1-5 severity score */
  severityScore: number;
  /** Bounding boxes (normalised 0-1 coordinates relative to image size) */
  lesions: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }>;
  /** Severity description text */
  severityDescription?: string;
  /** Show "[Demo Mode]" badge */
  isDemo?: boolean;
}

// ---------------------------------------------------------------------------
// Confidence bar colour
// ---------------------------------------------------------------------------

function confidenceColor(pct: number): string {
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 60) return 'bg-yellow-500';
  if (pct >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ResultCard({
  imageDataUrl,
  diseaseName,
  scientificName,
  confidence,
  severityScore,
  lesions,
  severityDescription,
  isDemo = false,
}: ResultCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Draw lesion bounding boxes on the canvas overlay whenever the image loads
  // or the lesions change.
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const draw = () => {
      const { naturalWidth: iw, naturalHeight: ih } = img;
      if (iw === 0 || ih === 0) return;

      // Match canvas resolution to the image's natural size
      canvas.width = iw;
      canvas.height = ih;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, iw, ih);

      for (const box of lesions) {
        const bx = box.x * iw;
        const by = box.y * ih;
        const bw = box.width * iw;
        const bh = box.height * ih;

        // Box outline
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)'; // red-500
        ctx.lineWidth = Math.max(2, Math.round(iw / 200));
        ctx.strokeRect(bx, by, bw, bh);

        // Confidence label background
        const label = `${Math.round(box.confidence * 100)}%`;
        const fontSize = Math.max(12, Math.round(iw / 30));
        ctx.font = `bold ${fontSize}px sans-serif`;
        const tm = ctx.measureText(label);
        const pad = 4;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.fillRect(bx, by - fontSize - pad * 2, tm.width + pad * 2, fontSize + pad * 2);

        // Confidence label text
        ctx.fillStyle = '#fff';
        ctx.fillText(label, bx + pad, by - pad);
      }
    };

    // If the image is already loaded (cached), draw immediately.
    if (img.complete && img.naturalWidth > 0) {
      draw();
    } else {
      img.addEventListener('load', draw);
      return () => img.removeEventListener('load', draw);
    }
  }, [lesions]);

  const pct = Math.round(confidence * 100);

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-md sm:flex sm:flex-row">
      {/* Image + bounding-box overlay */}
      <div className="relative w-full sm:w-1/2 sm:max-w-xs md:max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageDataUrl}
          alt={`Scan of peanut crop showing ${diseaseName}`}
          className="block w-full"
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />

        {/* Demo badge */}
        {isDemo && (
          <span className="absolute right-3 top-3 rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold text-yellow-900 shadow">
            [Demo Mode]
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="flex-1 space-y-4 p-4 sm:p-6">
        {/* Disease name */}
        <div>
          <h2 className="text-xl font-bold leading-tight text-gray-900">
            {diseaseName}
          </h2>
          <p className="text-sm italic text-gray-500">{scientificName}</p>
        </div>

        {/* Confidence bar */}
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">Confidence</span>
            <span className="font-semibold text-gray-900">{pct}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full transition-all duration-500 ${confidenceColor(pct)}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Severity */}
        <div>
          <p className="mb-1 text-sm font-medium text-gray-700">Severity</p>
          <SeverityMeter level={severityScore} description={severityDescription} />
        </div>
      </div>
    </div>
  );
}
