"use client";

import { type ReactNode, useState, useCallback } from "react";
import { motion, useMotionValue, useTransform } from "motion/react";

interface SwipeableTrackCardProps {
  children: ReactNode;
  onSwipeRight?: () => void; // thumbs up
  onSwipeLeft?: () => void; // thumbs down
  disabled?: boolean; // disable swiping (e.g., for own tracks)
}

export default function SwipeableTrackCard({
  children,
  onSwipeRight,
  onSwipeLeft,
  disabled = false,
}: SwipeableTrackCardProps) {
  const [committed, setCommitted] = useState<"right" | "left" | null>(null);
  const x = useMotionValue(0);

  // Opacity for action backgrounds based on drag position
  const positiveOpacity = useTransform(x, [0, 80], [0, 1]);
  const negativeOpacity = useTransform(x, [0, -80], [0, 1]);

  // Emoji scale based on drag progress
  const positiveScale = useTransform(x, [0, 80], [0.5, 1.2]);
  const negativeScale = useTransform(x, [-80, 0], [1.2, 0.5]);

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number }; velocity: { x: number } }) => {
      if (info.offset.x > 80) {
        // Swiped right — thumbs up
        navigator?.vibrate?.(10);
        setCommitted("right");
        onSwipeRight?.();
        setTimeout(() => setCommitted(null), 300);
      } else if (info.offset.x < -80) {
        // Swiped left — thumbs down
        navigator?.vibrate?.(10);
        setCommitted("left");
        onSwipeLeft?.();
        setTimeout(() => setCommitted(null), 300);
      }
    },
    [onSwipeRight, onSwipeLeft],
  );

  if (disabled) {
    return <div className="relative overflow-hidden rounded-xl">{children}</div>;
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Positive action background (right swipe) */}
      <motion.div
        className="absolute inset-0 swipe-action-positive flex items-center justify-start pl-6"
        style={{ opacity: committed === "right" ? 1 : positiveOpacity }}
      >
        <motion.span
          className="text-3xl select-none"
          style={{ scale: committed === "right" ? 1.2 : positiveScale }}
        >
          👍
        </motion.span>
      </motion.div>

      {/* Negative action background (left swipe) */}
      <motion.div
        className="absolute inset-0 swipe-action-negative flex items-center justify-end pr-6"
        style={{ opacity: committed === "left" ? 1 : negativeOpacity }}
      >
        <motion.span
          className="text-3xl select-none"
          style={{ scale: committed === "left" ? 1.2 : negativeScale }}
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
        onDragEnd={handleDragEnd}
        className="relative z-10"
      >
        {children}
      </motion.div>
    </div>
  );
}
