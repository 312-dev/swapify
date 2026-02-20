'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { springs, fade } from '@/lib/motion';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Users,
  PlusCircle,
  LayoutGrid,
} from 'lucide-react';

interface TourStep {
  target: string | null; // data-tour attribute value, null = centered card (no spotlight)
  title: string;
  description: string;
  icon: React.ReactNode;
  position?: 'above' | 'below'; // preferred tooltip position
}

const TOUR_STEPS: TourStep[] = [
  {
    target: null,
    title: 'Welcome to Swapify!',
    description: "Let's take a quick tour so you know your way around. It'll only take a moment.",
    icon: <Sparkles className="w-6 h-6 text-brand" />,
  },
  {
    target: 'circle-switcher',
    title: 'Your Circle',
    description:
      'A Circle is your friend group. Everyone in a Circle shares a musical mailbox — drop songs in, listen, react.',
    icon: <Users className="w-6 h-6 text-brand" />,
    position: 'below',
  },
  {
    target: 'create-swaplist',
    title: 'Create a Swaplist',
    description:
      'Tap here to start a new Swaplist. Friends drop songs in, everyone listens, and the queue clears itself.',
    icon: <PlusCircle className="w-6 h-6 text-brand" />,
    position: 'below',
  },
  {
    target: 'bottom-nav',
    title: 'Navigate Swapify',
    description:
      'Your Swaplists live on the home tab. Check Activity to see what friends are playing, and Profile for your settings.',
    icon: <LayoutGrid className="w-6 h-6 text-brand" />,
    position: 'above',
  },
  {
    target: null,
    title: "You're all set!",
    description:
      'Create your first Swaplist, invite friends, and start filling the mailbox. Happy swapping!',
    icon: <Sparkles className="w-6 h-6 text-accent-green" />,
  },
];

const SPOTLIGHT_PADDING = 8;
const SPOTLIGHT_RADIUS = 12;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function SpotlightTour({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const completedRef = useRef(false);

  const currentStep = TOUR_STEPS[step]!;

  // Calculate target element rect
  const updateRect = useCallback(() => {
    if (!currentStep.target) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
    if (!el) {
      setTargetRect(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    setTargetRect({
      top: rect.top - SPOTLIGHT_PADDING,
      left: rect.left - SPOTLIGHT_PADDING,
      width: rect.width + SPOTLIGHT_PADDING * 2,
      height: rect.height + SPOTLIGHT_PADDING * 2,
    });
  }, [currentStep.target]);

  useEffect(() => {
    // Initial rect calculation uses requestAnimationFrame to avoid
    // synchronous setState within the effect body.
    const raf = requestAnimationFrame(updateRect);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [updateRect]);

  const markComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    fetch('/api/user/tour-complete', { method: 'POST' }).catch(() => {});
    onComplete();
  }, [onComplete]);

  function handleNext() {
    if (step === TOUR_STEPS.length - 1) {
      markComplete();
      return;
    }
    setDirection(1);
    setStep((s) => s + 1);
  }

  function handleBack() {
    setDirection(-1);
    setStep((s) => s - 1);
  }

  // Determine tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) {
      // Centered card
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const preferAbove = currentStep.position === 'above';
    const gap = 12;

    if (preferAbove) {
      return {
        position: 'fixed',
        bottom: window.innerHeight - targetRect.top + gap,
        left: 16,
        right: 16,
      };
    }

    return {
      position: 'fixed',
      top: targetRect.top + targetRect.height + gap,
      left: 16,
      right: 16,
    };
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <m.div
      className="fixed inset-0 z-[100]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={fade}
    >
      {/* Dark overlay with cutout */}
      {targetRect ? (
        <svg className="fixed inset-0 w-full h-full" style={{ zIndex: 100 }}>
          <defs>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx={SPOTLIGHT_RADIUS}
                ry={SPOTLIGHT_RADIUS}
                fill="black"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.8)" mask="url(#spotlight-mask)" />
        </svg>
      ) : (
        <div
          className="fixed inset-0"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', zIndex: 100 }}
        />
      )}

      {/* Spotlight ring glow around target */}
      {targetRect && (
        <m.div
          className="fixed pointer-events-none"
          style={{
            zIndex: 101,
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            borderRadius: SPOTLIGHT_RADIUS,
            boxShadow: '0 0 0 2px rgba(56, 189, 248, 0.5), 0 0 20px 4px rgba(56, 189, 248, 0.15)',
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={springs.smooth}
          key={`ring-${step}`}
        />
      )}

      {/* Tooltip card */}
      <div style={{ zIndex: 102, ...getTooltipStyle() }}>
        <AnimatePresence mode="wait" custom={direction}>
          <m.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={springs.smooth}
            className="glass rounded-2xl p-5 border border-white/[0.08] max-w-sm mx-auto"
            style={{
              background: 'linear-gradient(135deg, rgba(30, 30, 30, 0.95), rgba(20, 20, 20, 0.98))',
              backdropFilter: 'blur(24px)',
            }}
          >
            {/* Skip button */}
            {step < TOUR_STEPS.length - 1 && (
              <button
                onClick={markComplete}
                className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Skip tour"
              >
                <X className="w-4 h-4 text-text-tertiary" />
              </button>
            )}

            {/* Icon + content */}
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                {currentStep.icon}
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-1.5">{currentStep.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {currentStep.description}
              </p>
            </div>

            {/* Step dots */}
            <div className="flex items-center justify-center gap-1.5 mt-4 mb-4">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step ? 'w-5 bg-brand' : 'w-1.5 bg-white/20'
                  }`}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-3">
              {step > 0 ? (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors px-3 py-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              ) : (
                <div />
              )}
              <button onClick={handleNext} className="btn-pill btn-pill-primary flex-1 text-sm">
                {step === TOUR_STEPS.length - 1 ? (
                  "Let's go!"
                ) : step === 0 ? (
                  'Show me around'
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </div>
          </m.div>
        </AnimatePresence>
      </div>
    </m.div>
  );
}
