/**
 * Client-side image compression for Spotify playlist covers.
 * Uses Canvas API — no external dependencies.
 *
 * Spotify requires: JPEG, base64-encoded, under 256 KB.
 */

const MAX_BYTES = 256 * 1024; // 256 KB
const MAX_DIMENSION = 640; // px — Spotify uses 640×640 max for covers
const INITIAL_QUALITY = 0.92;
const MIN_QUALITY = 0.3;
const QUALITY_STEP = 0.05;

/**
 * Compress an image File to a JPEG data URL under 256 KB.
 * Resizes if the image exceeds MAX_DIMENSION, then iteratively
 * reduces JPEG quality until the result fits.
 *
 * @returns data URL string (`data:image/jpeg;base64,...`)
 * @throws if the image can't be compressed below the limit
 */
export async function compressImageForSpotify(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  // Scale down if either dimension exceeds the cap
  let targetW = width;
  let targetH = height;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    targetW = Math.round(width * scale);
    targetH = Math.round(height * scale);
  }

  const canvas = new OffscreenCanvas(targetW, targetH);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  // Iteratively reduce quality until under 256 KB
  let quality = INITIAL_QUALITY;
  while (quality >= MIN_QUALITY) {
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    if (blob.size <= MAX_BYTES) {
      return blobToDataURL(blob);
    }
    quality -= QUALITY_STEP;
  }

  // Last resort: shrink dimensions further
  const smallerScale = 0.5;
  const smallCanvas = new OffscreenCanvas(
    Math.round(targetW * smallerScale),
    Math.round(targetH * smallerScale)
  );
  const smallCtx = smallCanvas.getContext('2d')!;
  smallCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);

  const finalBlob = await smallCanvas.convertToBlob({ type: 'image/jpeg', quality: MIN_QUALITY });
  if (finalBlob.size <= MAX_BYTES) {
    return blobToDataURL(finalBlob);
  }

  throw new Error('Image could not be compressed under 256 KB');
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
