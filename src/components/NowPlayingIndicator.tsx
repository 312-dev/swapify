'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

export interface ActiveListener {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  progressMs: number;
  durationMs: number;
  capturedAt: number;
}

interface NowPlayingIndicatorProps {
  listeners: ActiveListener[];
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Estimates the current playback, ticking forward in real-time. */
function useEstimatedPlayback(listeners: ActiveListener[]) {
  const [fraction, setFraction] = useState(0);
  const [estimatedMs, setEstimatedMs] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (listeners.length === 0) {
      return;
    }

    const listener = listeners[0]!;

    function tick() {
      const elapsed = Date.now() - listener.capturedAt;
      const ms = Math.min(listener.progressMs + elapsed, listener.durationMs);
      setEstimatedMs(ms);
      setFraction(listener.durationMs > 0 ? ms / listener.durationMs : 0);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [listeners]);

  // Derive zero values when no listeners (avoids setState-in-effect)
  const empty = listeners.length === 0;
  return {
    fraction: empty ? 0 : fraction,
    estimatedMs: empty ? 0 : estimatedMs,
    durationMs: listeners[0]?.durationMs ?? 0,
  };
}

export default function NowPlayingIndicator({ listeners }: NowPlayingIndicatorProps) {
  const { fraction, estimatedMs, durationMs } = useEstimatedPlayback(listeners);
  const [hovered, setHovered] = useState(false);

  const names =
    listeners.length === 1
      ? listeners[0]!.displayName
      : listeners.length === 2
        ? `${listeners[0]!.displayName} & ${listeners[1]!.displayName}`
        : `${listeners[0]!.displayName} & ${listeners.length - 1} others`;

  return (
    <AnimatePresence>
      {listeners.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="relative flex items-center gap-1.5"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* Animated equalizer bars */}
          <div className="flex items-end gap-[2px] h-4">
            <span
              className="equalizer-bar w-[3px] rounded-full bg-brand"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="equalizer-bar w-[3px] rounded-full bg-brand"
              style={{ animationDelay: '200ms' }}
            />
            <span
              className="equalizer-bar w-[3px] rounded-full bg-brand"
              style={{ animationDelay: '400ms' }}
            />
          </div>

          {/* Tiny avatar stack — max 2 visible */}
          <div className="flex -space-x-1.5">
            {listeners.slice(0, 2).map((l) => (
              <div
                key={l.id}
                className="w-4 h-4 rounded-full border border-[var(--background)] overflow-hidden shrink-0"
              >
                {l.avatarUrl ? (
                  <img
                    src={l.avatarUrl}
                    alt={l.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-white/10 flex items-center justify-center text-[7px] font-bold text-text-secondary">
                    {l.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            ))}
            {listeners.length > 2 && (
              <div className="w-4 h-4 rounded-full border border-[var(--background)] bg-white/10 flex items-center justify-center text-[7px] font-bold text-text-secondary shrink-0">
                +{listeners.length - 2}
              </div>
            )}
          </div>

          {/* Live progress bar */}
          <div className="w-8 h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-brand rounded-full transition-none"
              style={{ width: `${Math.min(fraction * 100, 100)}%` }}
            />
          </div>

          {/* Custom live tooltip — positioned above the indicator */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.12 }}
                className="absolute bottom-full left-0 mb-1.5 whitespace-nowrap pointer-events-none z-50"
              >
                <div className="tooltip-portal">
                  {names} &middot; {formatMs(estimatedMs)} / {formatMs(durationMs)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
