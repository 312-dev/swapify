'use client';

import { useState, useEffect } from 'react';
import { extractColors, rgbaCss, darken, type ExtractedColors } from '@/lib/color-extract';

export interface AlbumColorStyle {
  /** Radial gradient for the header background */
  backgroundImage: string;
  /** Whether colors have been extracted (vs. fallback) */
  isExtracted: boolean;
  /** Raw extracted colors (null if using fallback) */
  colors: ExtractedColors | null;
}

/**
 * Hook that extracts dominant colors from an album/playlist image
 * and returns a CSS gradient string for the page background.
 *
 * Falls back to the default Arctic Aurora gradient if extraction fails
 * or no image URL is provided.
 */
const EMPTY: AlbumColorStyle = { backgroundImage: '', isExtracted: false, colors: null };

export function useAlbumColors(imageUrl: string | null): AlbumColorStyle {
  const [result, setResult] = useState<AlbumColorStyle>(EMPTY);

  useEffect(() => {
    if (!imageUrl) {
      return;
    }

    let cancelled = false;

    extractColors(imageUrl).then((colors) => {
      if (cancelled) return;

      if (!colors) {
        setResult(EMPTY);
        return;
      }

      // Rich, vibrant gradient — let the album art really show through
      const darkPrimary = darken(colors.primary, 0.55);
      const darkSecondary = darken(colors.secondary, 0.4);

      const gradient = [
        `radial-gradient(ellipse 80% 60% at 50% 0%, ${rgbaCss(darkPrimary, 1)} 0%, transparent 70%)`,
        `radial-gradient(ellipse 60% 70% at 80% 20%, ${rgbaCss(darkSecondary, 0.7)} 0%, transparent 60%)`,
        `radial-gradient(ellipse 50% 50% at 20% 30%, ${rgbaCss(colors.primary, 0.3)} 0%, transparent 50%)`,
        `radial-gradient(ellipse 70% 40% at 50% 100%, ${rgbaCss(colors.secondary, 0.15)} 0%, transparent 50%)`,
      ].join(', ');

      setResult({
        backgroundImage: gradient,
        isExtracted: true,
        colors,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  // Derive empty when no URL (avoids setState-in-effect for reset)
  return imageUrl ? result : EMPTY;
}

export interface CardTint {
  /** Subtle left-edge gradient for row background */
  background: string;
  /** Accent color for the vibe text */
  vibeColor: string;
}

const EMPTY_TINT: CardTint = { background: '', vibeColor: '' };

/**
 * Lightweight hook that extracts a subtle tint from a playlist/album image
 * for use in list cards. Returns a gentle left-edge gradient and accent color.
 */
export function useCardTint(imageUrl: string | null): CardTint {
  const [tint, setTint] = useState<CardTint>(EMPTY_TINT);

  useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;

    extractColors(imageUrl).then((colors) => {
      if (cancelled || !colors) return;

      const [r, g, b] = colors.primary;
      setTint({
        background: `linear-gradient(135deg, rgba(${r}, ${g}, ${b}, 0.12) 0%, transparent 60%)`,
        vibeColor: `rgba(${r}, ${g}, ${b}, 0.85)`,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return imageUrl ? tint : EMPTY_TINT;
}
