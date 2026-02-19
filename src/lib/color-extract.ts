/**
 * Client-side dominant color extraction from images using Canvas.
 *
 * Draws the image onto a small canvas, samples all pixels, and uses simple
 * color quantization to find the most prominent colors. Works with
 * cross-origin images (Spotify CDN sends CORS headers).
 */

export interface ExtractedColors {
  /** Most dominant color */
  primary: [number, number, number];
  /** Second-most dominant color (contrasting) */
  secondary: [number, number, number];
}

/** Euclidean distance between two RGB colors */
function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/** Perceived brightness (0–255) */
function brightness([r, g, b]: [number, number, number]): number {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

/**
 * Simple k-means–style color quantization.
 * Returns the top N dominant colors sorted by pixel count.
 */
function quantize(
  pixels: Uint8ClampedArray,
  bucketSize = 24
): Array<{ color: [number, number, number]; count: number }> {
  const buckets = new Map<string, { sum: [number, number, number]; count: number }>();

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]!;
    const g = pixels[i + 1]!;
    const b = pixels[i + 2]!;
    const alpha = pixels[i + 3]!;

    // Skip transparent / near-black / near-white pixels
    if (alpha < 128) continue;
    if (r + g + b < 30) continue; // too dark
    if (r > 240 && g > 240 && b > 240) continue; // too bright

    // Quantize to bucket
    const br = Math.round(r / bucketSize) * bucketSize;
    const bg = Math.round(g / bucketSize) * bucketSize;
    const bb = Math.round(b / bucketSize) * bucketSize;
    const key = `${br},${bg},${bb}`;

    const existing = buckets.get(key);
    if (existing) {
      existing.sum[0] += r;
      existing.sum[1] += g;
      existing.sum[2] += b;
      existing.count++;
    } else {
      buckets.set(key, { sum: [r, g, b], count: 1 });
    }
  }

  return Array.from(buckets.values())
    .map(({ sum, count }) => ({
      color: [
        Math.round(sum[0] / count),
        Math.round(sum[1] / count),
        Math.round(sum[2] / count),
      ] as [number, number, number],
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Extract dominant colors from an image URL.
 * Returns null if extraction fails (CORS, network, etc).
 */
export function extractColors(imageUrl: string): Promise<ExtractedColors | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        // Sample at small size for performance
        const size = 64;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        const ranked = quantize(imageData.data);

        if (ranked.length === 0) {
          resolve(null);
          return;
        }

        const primary = ranked[0]!.color;

        // Find a secondary color that's sufficiently different from primary
        let secondary = primary;
        for (let i = 1; i < ranked.length; i++) {
          const candidate = ranked[i]!;
          const dist = colorDistance(primary, candidate.color);
          const brightDiff = Math.abs(brightness(primary) - brightness(candidate.color));
          // Require meaningful difference in both hue and brightness
          if (dist > 80 || brightDiff > 40) {
            secondary = candidate.color;
            break;
          }
        }

        resolve({ primary, secondary });
      } catch {
        // Canvas tainted or other error
        resolve(null);
      }
    };

    img.onerror = () => resolve(null);

    // Timeout after 5s
    setTimeout(() => resolve(null), 5000);

    img.src = imageUrl;
  });
}

/** Convert RGB to a CSS rgba() string with given alpha */
export function rgbaCss([r, g, b]: [number, number, number], alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Darken an RGB color by a factor (0 = black, 1 = unchanged).
 * Useful for creating dark-mode-safe gradients from extracted colors.
 */
export function darken(
  [r, g, b]: [number, number, number],
  factor: number
): [number, number, number] {
  return [Math.round(r * factor), Math.round(g * factor), Math.round(b * factor)];
}
