'use client';

import type { Variants } from 'motion/react';
import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

import { cn } from '@/lib/utils';

export interface DeleteIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface DeleteIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  autoAnimate?: boolean;
}

const LID_VARIANTS: Variants = {
  normal: {
    rotate: 0,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 13,
    },
  },
  animate: {
    rotate: [-15, 0],
    y: [-2, 0],
    transition: {
      duration: 0.4,
      ease: 'easeInOut',
      repeat: Number.POSITIVE_INFINITY,
      repeatDelay: 1.6,
    },
  },
};

const BODY_VARIANTS: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
  },
  animate: {
    opacity: [0, 1],
    pathLength: [0, 1],
    transition: {
      delay: 0.2,
      duration: 0.4,
      opacity: { duration: 0.2, delay: 0.2 },
      repeat: Number.POSITIVE_INFINITY,
      repeatDelay: 1.6,
    },
  },
};

const DeleteIcon = forwardRef<DeleteIconHandle, DeleteIconProps>(
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
        <svg
          fill="none"
          height={size}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Trash lid — rotates open */}
          <motion.g
            animate={controls}
            variants={LID_VARIANTS}
            style={{ originX: '70%', originY: '100%' }}
          >
            <path d="M3 6h18" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </motion.g>
          {/* Trash body — draws in */}
          <motion.path
            d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"
            animate={controls}
            variants={BODY_VARIANTS}
            initial="normal"
          />
          {/* Inner lines */}
          <motion.line
            x1="10"
            y1="11"
            x2="10"
            y2="17"
            animate={controls}
            variants={BODY_VARIANTS}
            initial="normal"
          />
          <motion.line
            x1="14"
            y1="11"
            x2="14"
            y2="17"
            animate={controls}
            variants={BODY_VARIANTS}
            initial="normal"
          />
        </svg>
      </div>
    );
  }
);

DeleteIcon.displayName = 'DeleteIcon';

export { DeleteIcon };
