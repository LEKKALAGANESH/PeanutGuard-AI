/**
 * Pure-JS EXIF orientation reader and canvas transform applicator.
 * No external dependencies — reads raw JPEG bytes directly.
 */

/** Maximum bytes to read for EXIF header (64KB is more than enough). */
const EXIF_READ_LIMIT = 65536;

/** JPEG Start-Of-Image marker. */
const JPEG_SOI = 0xffd8;

/** JPEG APP1 marker (contains EXIF). */
const JPEG_APP1 = 0xffe1;

/** ASCII "Exif" followed by two null bytes. */
const EXIF_HEADER = 0x45786966;

/** EXIF orientation tag ID. */
const ORIENTATION_TAG = 0x0112;

/**
 * Read a 16-bit unsigned value from a DataView respecting endianness.
 */
function readUint16(
  view: DataView,
  offset: number,
  littleEndian: boolean
): number {
  return view.getUint16(offset, littleEndian);
}

/**
 * Read a 32-bit unsigned value from a DataView respecting endianness.
 */
function readUint32(
  view: DataView,
  offset: number,
  littleEndian: boolean
): number {
  return view.getUint32(offset, littleEndian);
}

/**
 * Read EXIF orientation from a JPEG file.
 *
 * Parses the first 64KB for the APP1 marker, locates the EXIF IFD,
 * and reads the orientation tag (0x0112).
 *
 * @returns Orientation value 1-8, or 1 (normal) for non-JPEG / missing EXIF.
 */
export async function getExifOrientation(file: File): Promise<number> {
  try {
    // Only JPEG files contain EXIF
    if (file.type && !file.type.includes('jpeg') && !file.type.includes('jpg')) {
      return 1;
    }

    const slice = file.slice(0, EXIF_READ_LIMIT);
    const buffer = await slice.arrayBuffer();
    const view = new DataView(buffer);

    // Verify JPEG SOI
    if (buffer.byteLength < 2 || view.getUint16(0, false) !== JPEG_SOI) {
      return 1;
    }

    // Scan for APP1 marker
    let offset = 2;
    while (offset < buffer.byteLength - 4) {
      const marker = view.getUint16(offset, false);

      // If we hit SOS (Start of Scan) or beyond, stop searching
      if (marker === 0xffda) {
        return 1;
      }

      if (marker === JPEG_APP1) {
        return parseExifOrientation(view, offset);
      }

      // Skip to next marker: marker (2 bytes) + length (2 bytes, includes itself)
      if ((marker & 0xff00) !== 0xff00) {
        // Not a valid marker, bail
        return 1;
      }

      const segmentLength = view.getUint16(offset + 2, false);
      offset += 2 + segmentLength;
    }

    return 1;
  } catch {
    // Any parse error means we return default orientation
    return 1;
  }
}

/**
 * Parse the EXIF orientation value from an APP1 segment.
 */
function parseExifOrientation(view: DataView, app1Offset: number): number {
  // APP1 structure: marker(2) + length(2) + "Exif\0\0"(6) + TIFF header
  const exifStart = app1Offset + 4; // skip marker + length

  // Verify "Exif" header (4 bytes: 0x45786966)
  if (view.getUint32(exifStart, false) !== EXIF_HEADER) {
    return 1;
  }

  // TIFF header starts after "Exif\0\0" (6 bytes)
  const tiffStart = exifStart + 6;

  // Byte order: "II" (0x4949) = little-endian, "MM" (0x4D4D) = big-endian
  const byteOrder = view.getUint16(tiffStart, false);
  let littleEndian: boolean;

  if (byteOrder === 0x4949) {
    littleEndian = true;
  } else if (byteOrder === 0x4d4d) {
    littleEndian = false;
  } else {
    return 1;
  }

  // Verify TIFF magic number (42)
  if (readUint16(view, tiffStart + 2, littleEndian) !== 0x002a) {
    return 1;
  }

  // Offset to first IFD (relative to TIFF start)
  const ifdOffset = readUint32(view, tiffStart + 4, littleEndian);
  const ifdStart = tiffStart + ifdOffset;

  // Number of IFD entries
  if (ifdStart + 2 > view.byteLength) {
    return 1;
  }

  const numEntries = readUint16(view, ifdStart, littleEndian);

  // Scan IFD entries for orientation tag
  for (let i = 0; i < numEntries; i++) {
    const entryOffset = ifdStart + 2 + i * 12;

    if (entryOffset + 12 > view.byteLength) {
      return 1;
    }

    const tag = readUint16(view, entryOffset, littleEndian);

    if (tag === ORIENTATION_TAG) {
      // Orientation is a SHORT (type 3), value is in bytes 8-9 of the entry
      const orientation = readUint16(view, entryOffset + 8, littleEndian);

      // Valid orientations are 1 through 8
      if (orientation >= 1 && orientation <= 8) {
        return orientation;
      }

      return 1;
    }
  }

  return 1;
}

/**
 * Draw an image to a canvas context with EXIF orientation transforms applied.
 *
 * EXIF orientation values:
 *   1: Normal
 *   2: Flipped horizontally
 *   3: Rotated 180
 *   4: Flipped vertically
 *   5: Transposed (mirror + rotate 270 CW)
 *   6: Rotated 90 CW
 *   7: Transverse (mirror + rotate 90 CW)
 *   8: Rotated 270 CW (90 CCW)
 *
 * @param ctx - Canvas 2D rendering context
 * @param image - Source ImageBitmap to draw
 * @param orientation - EXIF orientation value (1-8)
 * @param width - Target canvas width
 * @param height - Target canvas height
 */
export function drawWithOrientation(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  image: ImageBitmap,
  orientation: number,
  width: number,
  height: number
): void {
  ctx.save();

  switch (orientation) {
    case 2:
      // Horizontal flip
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      break;

    case 3:
      // Rotate 180
      ctx.translate(width, height);
      ctx.rotate(Math.PI);
      break;

    case 4:
      // Vertical flip
      ctx.translate(0, height);
      ctx.scale(1, -1);
      break;

    case 5:
      // Transpose: mirror horizontal + rotate 270 CW
      // For orientations 5-8, source width/height are swapped in the draw call
      ctx.translate(0, 0);
      ctx.rotate(Math.PI * 0.5);
      ctx.scale(1, -1);
      ctx.drawImage(image, 0, 0, height, width);
      ctx.restore();
      return;

    case 6:
      // Rotate 90 CW
      ctx.translate(width, 0);
      ctx.rotate(Math.PI * 0.5);
      ctx.drawImage(image, 0, 0, height, width);
      ctx.restore();
      return;

    case 7:
      // Transverse: mirror horizontal + rotate 90 CW
      ctx.translate(width, 0);
      ctx.rotate(Math.PI * 0.5);
      ctx.scale(-1, 1);
      ctx.drawImage(image, 0, 0, height, width);
      ctx.restore();
      return;

    case 8:
      // Rotate 270 CW (90 CCW)
      ctx.translate(0, height);
      ctx.rotate(-Math.PI * 0.5);
      ctx.drawImage(image, 0, 0, height, width);
      ctx.restore();
      return;

    case 1:
    default:
      // No transform needed
      break;
  }

  ctx.drawImage(image, 0, 0, width, height);
  ctx.restore();
}
