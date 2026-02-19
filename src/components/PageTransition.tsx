"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useTransitionDirection } from "@/lib/TransitionContext";

const SLIDE_DISTANCE = 60;

const TRANSITION_SPRING = {
  type: "spring" as const,
  stiffness: 400,
  damping: 35,
  mass: 0.8,
};

export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const direction = useTransitionDirection();

  const xInitial =
    direction === "right"
      ? SLIDE_DISTANCE
      : direction === "left"
        ? -SLIDE_DISTANCE
        : 0;

  const xExit =
    direction === "right"
      ? -SLIDE_DISTANCE
      : direction === "left"
        ? SLIDE_DISTANCE
        : 0;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={
          direction === "none"
            ? false
            : { x: xInitial, opacity: 0 }
        }
        animate={{ x: 0, opacity: 1 }}
        exit={
          direction === "none"
            ? undefined
            : { x: xExit, opacity: 0 }
        }
        transition={TRANSITION_SPRING}
        style={{ willChange: "transform, opacity" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
