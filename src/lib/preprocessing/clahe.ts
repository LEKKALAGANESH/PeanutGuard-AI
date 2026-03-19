/**
 * CLAHE (Contrast Limited Adaptive Histogram Equalization)
 * Pure TypeScript implementation using typed arrays — no OpenCV dependency.
 */

/**
 * Convert RGB to lightness (simple average of max and min channel).
 * Returns a value in [0, 255].
 */
function rgbToLightness(r: number, g: number, b: number): number {
  const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
  const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
  return (max + min) >> 1;
}

/**
 * Compute a clipped and redistributed histogram for one tile.
 *
 * 1. Build a 256-bin histogram from the lightness values in the tile.
 * 2. Clip counts that exceed clipLimit, accumulating the excess.
 * 3. Redistribute excess evenly across all bins (with remainder spread one-per-bin).
 * 4. Compute the cumulative distribution function (CDF) and normalize to [0, 255].
 */
function computeTileCDF(
  lightness: Uint8Array,
  width: number,
  tileX: number,
  tileY: number,
  tileW: number,
  tileH: number,
  clipLimit: number
): Uint8Array {
  const hist = new Uint32Array(256);
  const tilePixels = tileW * tileH;

  // Build histogram
  for (let dy = 0; dy < tileH; dy++) {
    const rowOffset = (tileY + dy) * width + tileX;
    for (let dx = 0; dx < tileW; dx++) {
      hist[lightness[rowOffset + dx]]++;
    }
  }

  // Compute actual clip limit in counts
  const actualClipLimit = Math.max(1, Math.round(clipLimit * (tilePixels / 256)));

  // Clip histogram and accumulate excess
  let excess = 0;
  for (let i = 0; i < 256; i++) {
    if (hist[i] > actualClipLimit) {
      excess += hist[i] - actualClipLimit;
      hist[i] = actualClipLimit;
    }
  }

  // Redistribute excess evenly
  const perBin = Math.floor(excess / 256);
  let remainder = excess - perBin * 256;

  for (let i = 0; i < 256; i++) {
    hist[i] += perBin;
    if (remainder > 0) {
      hist[i]++;
      remainder--;
    }
  }

  // Compute CDF and normalize to [0, 255]
  const cdf = new Uint8Array(256);
  let cumulative = 0;
  const scale = 255 / tilePixels;

  for (let i = 0; i < 256; i++) {
    cumulative += hist[i];
    cdf[i] = Math.min(255, Math.max(0, Math.round(cumulative * scale)));
  }

  return cdf;
}

/**
 * Apply CLAHE to ImageData for lighting normalization.
 * Pure JS implementation — no OpenCV dependency.
 *
 * @param imageData - Source image data (will not be mutated)
 * @param clipLimit - Contrast clip limit (default 2.0)
 * @param tileSize - Grid tile size in pixels (default 8)
 * @returns New ImageData with equalized lighting
 */
export function applyCLAHE(
  imageData: ImageData,
  clipLimit: number = 2.0,
  tileSize: number = 8
): ImageData {
  const { data, width, height } = imageData;

  // Compute lightness channel
  const totalPixels = width * height;
  const lightness = new Uint8Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    lightness[i] = rgbToLightness(data[offset], data[offset + 1], data[offset + 2]);
  }

  // Compute grid dimensions
  const tilesX = Math.max(1, Math.floor(width / tileSize));
  const tilesY = Math.max(1, Math.floor(height / tileSize));

  // Actual tile dimensions (may not divide evenly)
  const tileW = Math.floor(width / tilesX);
  const tileH = Math.floor(height / tilesY);

  // Compute CDF for each tile
  // cdfs[ty][tx] = Uint8Array(256)
  const cdfs: Uint8Array[][] = [];

  for (let ty = 0; ty < tilesY; ty++) {
    cdfs[ty] = [];
    for (let tx = 0; tx < tilesX; tx++) {
      const startX = tx * tileW;
      const startY = ty * tileH;

      // Handle last tile extending to image edge
      const currentTileW = tx === tilesX - 1 ? width - startX : tileW;
      const currentTileH = ty === tilesY - 1 ? height - startY : tileH;

      cdfs[ty][tx] = computeTileCDF(
        lightness,
        width,
        startX,
        startY,
        currentTileW,
        currentTileH,
        clipLimit
      );
    }
  }

  // Create output buffer
  const output = new Uint8ClampedArray(data.length);

  // For each pixel, bilinear interpolate between 4 nearest tile CDFs
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIdx = y * width + x;
      const L = lightness[pixelIdx];

      // Find the position within the tile grid (center-relative)
      // Tile centers are at (tx * tileW + tileW/2, ty * tileH + tileH/2)
      const fx = (x - tileW * 0.5) / tileW;
      const fy = (y - tileH * 0.5) / tileH;

      // Determine the four surrounding tile indices
      const tx1 = Math.max(0, Math.min(tilesX - 1, Math.floor(fx)));
      const ty1 = Math.max(0, Math.min(tilesY - 1, Math.floor(fy)));
      const tx2 = Math.min(tilesX - 1, tx1 + 1);
      const ty2 = Math.min(tilesY - 1, ty1 + 1);

      // Interpolation weights
      const ax = Math.max(0, Math.min(1, fx - tx1));
      const ay = Math.max(0, Math.min(1, fy - ty1));

      // Lookup CDF values for the 4 surrounding tiles
      const topLeft = cdfs[ty1][tx1][L];
      const topRight = cdfs[ty1][tx2][L];
      const bottomLeft = cdfs[ty2][tx1][L];
      const bottomRight = cdfs[ty2][tx2][L];

      // Bilinear interpolation
      const top = topLeft * (1 - ax) + topRight * ax;
      const bottom = bottomLeft * (1 - ax) + bottomRight * ax;
      const newL = top * (1 - ay) + bottom * ay;

      // Apply equalized lightness back to RGB channels proportionally
      const offset = pixelIdx * 4;
      const originalL = L || 1; // avoid division by zero
      const scale = newL / originalL;

      output[offset] = Math.min(255, Math.max(0, Math.round(data[offset] * scale)));
      output[offset + 1] = Math.min(255, Math.max(0, Math.round(data[offset + 1] * scale)));
      output[offset + 2] = Math.min(255, Math.max(0, Math.round(data[offset + 2] * scale)));
      output[offset + 3] = data[offset + 3]; // preserve alpha
    }
  }

  return new ImageData(output, width, height);
}
