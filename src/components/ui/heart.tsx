'use client';

import type { Variants } from 'motion/react';
import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

import { cn } from '@/lib/utils';

export interface HeartIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface HeartIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  autoAnimate?: boolean;
}

const HEART_VARIANTS: Variants = {
  normal: {
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 13,
    },
  },
  animate: {
    scale: [1, 1.25, 1, 1.15, 1],
    transition: {
      duration: 0.7,
      ease: 'easeInOut',
      repeat: Number.POSITIVE_INFINITY,
      repeatDelay: 1.4,
    },
  },
};

const PATH_VARIANTS: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
  },
  animate: {
    opacity: [0.6, 1, 0.6, 1, 1],
    pathLength: [0, 1],
    transition: {
      duration: 0.5,
      opacity: { duration: 0.7, delay: 0 },
      repeat: Number.POSITIVE_INFINITY,
      repeatDelay: 1.4,
    },
  },
};

const HeartIcon = forwardRef<HeartIconHandle, HeartIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, autoAnimate = false, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: () => controls.start('animate'),
        stopAnimation: () => controls.start('normal'),
      };
    });

    useEffect(() => {
      if (autoAnimate) {
        controls.start('animate');
      }
    }, [autoAnimate, controls]);

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseEnter?.(e);
        } else {
          controls.start('animate');
        }
      },
      [controls, onMouseEnter]
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseLeave?.(e);
        } else {
          controls.start('normal');
        }
      },
      [controls, onMouseLeave]
    );

    return (
      <div
        className={cn(className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <motion.svg
          fill="none"
          height={size}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
          animate={controls}
          variants={HEART_VARIANTS}
          style={{ originX: '50%', originY: '50%' }}
        >
          <motion.path
            d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
            variants={PATH_VARIANTS}
            initial="normal"
            animate={controls}
          />
        </motion.svg>
      </div>
    );
  }
);

HeartIcon.displayName = 'HeartIcon';

export { HeartIcon };
