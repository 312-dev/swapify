'use client';

import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useTransitionType } from '@/lib/TransitionContext';

const SLIDE_DISTANCE = 50;

export default function PageTransition({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const type = useTransitionType();

  const isSlide = type === 'slide-left' || type === 'slide-right';
  const isRight = type === 'slide-right';

  // Only use pathname as key for slide transitions (drill-down/up).
  // Tab switches use a stable key so React swaps children in-place
  // without an unmount/remount cycle — prevents flicker.
  const motionKey = isSlide ? pathname : 'tabs';

  // For non-slide (tab switches): pass undefined for all motion props so the
  // wrapper is inert. Using `initial={false}` would propagate to ALL descendant
  // motion components and suppress their entrance animations.
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={motionKey}
        initial={
          isSlide ? { x: isRight ? SLIDE_DISTANCE : -SLIDE_DISTANCE, opacity: 0 } : undefined
        }
        animate={isSlide ? { x: 0, opacity: 1 } : undefined}
        exit={isSlide ? { opacity: 0, transition: { duration: 0.05 } } : undefined}
        transition={isSlide ? { type: 'spring', stiffness: 400, damping: 35 } : undefined}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
