'use client';

import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useTransitionType } from '@/lib/TransitionContext';

const SLIDE_DISTANCE = 50;

function getInitial(type: string, isSlide: boolean, isRight: boolean) {
  if (type === 'none') return false as const;
  if (isSlide) return { x: isRight ? SLIDE_DISTANCE : -SLIDE_DISTANCE, opacity: 0 };
  return { opacity: 0 };
}

function getExit(type: string, isSlide: boolean) {
  if (type === 'none') return undefined;
  if (isSlide) return { opacity: 0, transition: { duration: 0.05 } };
  return { opacity: 0 };
}

export default function PageTransition({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const type = useTransitionType();

  const isSlide = type === 'slide-left' || type === 'slide-right';
  const isRight = type === 'slide-right';

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={getInitial(type, isSlide, isRight)}
        animate={isSlide ? { x: 0, opacity: 1 } : { opacity: 1 }}
        exit={getExit(type, isSlide)}
        transition={isSlide ? { type: 'spring', stiffness: 400, damping: 35 } : { duration: 0.15 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
