'use client';

import type { Variants } from 'motion/react';
import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

import { cn } from '@/lib/utils';

export interface HandMetalIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface HandMetalIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  autoAnimate?: boolean;
}

const ROCK_VARIANTS: Variants = {
  normal: {
    rotate: 0,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 13,
    },
  },
  animate: {
    rotate: [-12, 12, -8, 6, 0],
    transition: {
      duration: 0.8,
      ease: 'easeInOut',
      repeat: Number.POSITIVE_INFINITY,
      repeatDelay: 1.2,
    },
  },
};

const HandMetalIcon = forwardRef<HandMetalIconHandle, HandMetalIconProps>(
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
          variants={ROCK_VARIANTS}
          style={{ originX: '50%', originY: '100%' }}
        >
          <path d="M18 12.5V10a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1.4" />
          <path d="M14 11V9a2 2 0 1 0-4 0v2" />
          <path d="M10 10.5V5a2 2 0 1 0-4 0v9" />
          <path d="m7 15-1.76-1.76a2 2 0 0 0-2.83 2.82l3.6 3.6C7.5 21.14 9.2 22 12 22h2a8 8 0 0 0 8-8V7a2 2 0 1 0-4 0v5" />
        </motion.svg>
      </div>
    );
  }
);

HandMetalIcon.displayName = 'HandMetalIcon';

export { HandMetalIcon };
