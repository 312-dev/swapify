/**
 * Shared motion presets for consistent animation language across Swapify.
 *
 * Three spring categories:
 * - snappy: Micro-interactions (tap feedback, reaction bubbles)
 * - smooth: Panels and overlays (drawers, banners, install prompts)
 * - gentle: Content entrances (list items, page transitions)
 */

export const springs = {
  /** Micro-interactions: taps, reaction bubbles, popover appear */
  snappy: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 28,
  },
  /** Panels and overlays: drawers, bottom sheets, banners */
  smooth: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 28,
  },
  /** Content entrances: list items, page transitions */
  gentle: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
    mass: 0.8,
  },
} as const;

/** Fade transition for backdrops and overlays */
export const fade = {
  duration: 0.15,
} as const;

/** Staggered list item delay multiplier (seconds) */
export const STAGGER_DELAY = 0.03;
