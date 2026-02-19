'use client';

import { type ReactNode, useState, useCallback, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import ReactionOverlay from '@/components/ReactionOverlay';

interface SwipeableTrackCardProps {
  children: ReactNode;
  onSwipeRight?: () => void; // thumbs up
  onSwipeLeft?: () => void; // thumbs down
  onReaction?: (reaction: string) => void;
  disabled?: boolean; // disable swiping (e.g., for own tracks)
  currentReaction?: string | null;
}

export default function SwipeableTrackCard({
  children,
  onSwipeRight,
  onSwipeLeft,
  onReaction,
  disabled = false,
  currentReaction = null,
}: SwipeableTrackCardProps) {
  const [committed, setCommitted] = useState<'right' | 'left' | null>(null);
  const [showReactionOverlay, setShowReactionOverlay] = useState(false);
  const x = useMotionValue(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Opacity for action backgrounds based on drag position
  const positiveOpacity = useTransform(x, [0, 80], [0, 1]);
  const negativeOpacity = useTransform(x, [0, -80], [0, 1]);

  // Emoji scale based on drag progress
  const positiveScale = useTransform(x, [0, 80], [0.5, 1.2]);
  const negativeScale = useTransform(x, [-80, 0], [1.2, 0.5]);

  const handleDragStart = useCallback(() => {
    setShowReactionOverlay(false);
  }, []);

  const handleDragEnd = useCallback(
    (
      _event: MouseEvent | TouchEvent | PointerEvent,
      info: { offset: { x: number }; velocity: { x: number } }
    ) => {
      if (info.offset.x > 80) {
        // Swiped right — thumbs up
        navigator?.vibrate?.(10);
        setCommitted('right');
        onSwipeRight?.();
        setTimeout(() => setCommitted(null), 300);
      } else if (info.offset.x < -80) {
        // Swiped left — thumbs down
        navigator?.vibrate?.(10);
        setCommitted('left');
        onSwipeLeft?.();
        setTimeout(() => setCommitted(null), 300);
      }
    },
    [onSwipeRight, onSwipeLeft]
  );

  const handleTap = useCallback((event: MouseEvent | TouchEvent | PointerEvent) => {
    // Don't trigger double-tap on the play button
    const target = event.target as HTMLElement;
    if (target.closest('[data-play-button]')) return;

    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      // Double tap detected
      navigator?.vibrate?.(10);
      setShowReactionOverlay(true);
      lastTapRef.current = 0;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    } else {
      lastTapRef.current = now;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      tapTimerRef.current = setTimeout(() => {
        lastTapRef.current = 0;
      }, 300);
    }
  }, []);

  const handleOverlaySelect = useCallback(
    (reaction: string) => {
      setShowReactionOverlay(false);
      onReaction?.(reaction);
    },
    [onReaction]
  );

  if (disabled) {
    return <div className="relative overflow-hidden rounded-xl">{children}</div>;
  }

  return (
    <div ref={wrapperRef} className="relative overflow-hidden rounded-xl">
      {/* Positive action background (right swipe) */}
      <motion.div
        className="absolute inset-0 swipe-action-positive flex items-center justify-start pl-6"
        style={{ opacity: committed === 'right' ? 1 : positiveOpacity }}
      >
        <motion.span
          className="text-3xl select-none"
          style={{ scale: committed === 'right' ? 1.2 : positiveScale }}
        >
          👍
        </motion.span>
      </motion.div>

      {/* Negative action background (left swipe) */}
      <motion.div
        className="absolute inset-0 swipe-action-negative flex items-center justify-end pr-6"
        style={{ opacity: committed === 'left' ? 1 : negativeOpacity }}
      >
        <motion.span
          className="text-3xl select-none"
          style={{ scale: committed === 'left' ? 1.2 : negativeScale }}
        >
          👎
        </motion.span>
      </motion.div>

      {/* Draggable card content */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.3}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onTap={handleTap}
        className="relative z-10"
      >
        {children}
      </motion.div>

      {/* Reaction overlay */}
      <ReactionOverlay
        isOpen={showReactionOverlay}
        onSelect={handleOverlaySelect}
        onClose={() => setShowReactionOverlay(false)}
        currentReaction={currentReaction}
        anchorRef={wrapperRef}
      />
    </div>
  );
}
