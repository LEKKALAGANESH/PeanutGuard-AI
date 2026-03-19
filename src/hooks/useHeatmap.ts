'use client';

import { useCallback, useRef, useState } from 'react';
import type { LesionDetection } from '@/types';

// Viridis-inspired colormap (simplified 5-stop gradient)
const VIRIDIS: [number, number, number][] = [
  [68, 1, 84],
  [59, 82, 139],
  [33, 145, 140],
  [94, 201, 98],
  [253, 231, 37],
];

function interpolateColor(
  t: number,
): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const segment = clamped * (VIRIDIS.length - 1);
  const i = Math.floor(segment);
  const f = segment - i;
  const a = VIRIDIS[Math.min(i, VIRIDIS.length - 1)];
  const b = VIRIDIS[Math.min(i + 1, VIRIDIS.length - 1)];
  return [
    Math.round(a[0] + f * (b[0] - a[0])),
    Math.round(a[1] + f * (b[1] - a[1])),
    Math.round(a[2] + f * (b[2] - a[2])),
  ];
}

export function useHeatmap() {
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showBoxes, setShowBoxes] = useState(true);
  const [opacity, setOpacity] = useState(0.4);
  const heatmapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawOverlay = useCallback(
    (
      canvas: HTMLCanvasElement,
      image: HTMLImageElement | HTMLCanvasElement,
      lesions: LesionDetection[],
      displayShowHeatmap: boolean,
      displayShowBoxes: boolean,
      displayOpacity: number,
    ) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = image.width || (image as HTMLCanvasElement).width;
      canvas.height = image.height || (image as HTMLCanvasElement).height;

      // Draw base image
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      // Draw bounding boxes
      if (displayShowBoxes && lesions.length > 0) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.lineWidth = 2;
        ctx.font = '12px sans-serif';

        for (const lesion of lesions) {
          const x = lesion.x * canvas.width;
          const y = lesion.y * canvas.height;
          const w = lesion.width * canvas.width;
          const h = lesion.height * canvas.height;

          ctx.strokeRect(x, y, w, h);

          // Label background
          const label = `${Math.round(lesion.confidence * 100)}%`;
          const textWidth = ctx.measureText(label).width;
          ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
          ctx.fillRect(x, y - 16, textWidth + 6, 16);
          ctx.fillStyle = '#fff';
          ctx.fillText(label, x + 3, y - 4);
        }
      }

      // Draw heatmap overlay from lesion density
      if (displayShowHeatmap && lesions.length > 0) {
        const heatW = canvas.width;
        const heatH = canvas.height;
        const density = new Float32Array(heatW * heatH);

        // Gaussian kernel from each lesion center
        const sigma = Math.max(heatW, heatH) * 0.08;
        const sigma2 = 2 * sigma * sigma;

        for (const lesion of lesions) {
          const cx = (lesion.x + lesion.width / 2) * heatW;
          const cy = (lesion.y + lesion.height / 2) * heatH;
          const radius = Math.ceil(sigma * 3);

          const x0 = Math.max(0, Math.floor(cx - radius));
          const x1 = Math.min(heatW - 1, Math.ceil(cx + radius));
          const y0 = Math.max(0, Math.floor(cy - radius));
          const y1 = Math.min(heatH - 1, Math.ceil(cy + radius));

          for (let py = y0; py <= y1; py++) {
            for (let px = x0; px <= x1; px++) {
              const dx = px - cx;
              const dy = py - cy;
              const value = lesion.confidence * Math.exp(-(dx * dx + dy * dy) / sigma2);
              density[py * heatW + px] += value;
            }
          }
        }

        // Normalize density to [0, 1]
        let maxDensity = 0;
        for (let i = 0; i < density.length; i++) {
          if (density[i] > maxDensity) maxDensity = density[i];
        }

        if (maxDensity > 0) {
          const imageData = ctx.getImageData(0, 0, heatW, heatH);
          const pixels = imageData.data;

          for (let i = 0; i < density.length; i++) {
            const t = density[i] / maxDensity;
            if (t < 0.01) continue; // skip near-zero

            const [r, g, b] = interpolateColor(t);
            const alpha = t * displayOpacity;
            const idx = i * 4;

            // Alpha blend heatmap over existing pixel
            pixels[idx] = Math.round(pixels[idx] * (1 - alpha) + r * alpha);
            pixels[idx + 1] = Math.round(pixels[idx + 1] * (1 - alpha) + g * alpha);
            pixels[idx + 2] = Math.round(pixels[idx + 2] * (1 - alpha) + b * alpha);
          }

          ctx.putImageData(imageData, 0, 0);
        }
      }
    },
    [],
  );

  const toggleHeatmap = useCallback(() => setShowHeatmap((v) => !v), []);
  const toggleBoxes = useCallback(() => setShowBoxes((v) => !v), []);

  return {
    showHeatmap,
    showBoxes,
    opacity,
    setOpacity,
    toggleHeatmap,
    toggleBoxes,
    drawOverlay,
    heatmapCanvasRef,
  };
}
