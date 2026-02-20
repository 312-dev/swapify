'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { springs } from '@/lib/motion';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('install-prompt-dismissed') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // Don't show if already installed or on desktop
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    setDismissed(true);
    try {
      sessionStorage.setItem('install-prompt-dismissed', '1');
    } catch {}
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setDeferredPrompt(null);
    try {
      sessionStorage.setItem('install-prompt-dismissed', '1');
    } catch {}
  }, []);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const { offset, velocity } = info;
      const swipedDown = offset.y > 60 || velocity.y > 300;
      const swipedSide = Math.abs(offset.x) > 80 || Math.abs(velocity.x) > 300;
      if (swipedDown || swipedSide) {
        handleDismiss();
      }
    },
    [handleDismiss]
  );

  const show = deferredPrompt && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 72 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 72 }}
          transition={springs.smooth}
          drag
          dragDirectionLock={false}
          dragElastic={0.35}
          dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
          onDragEnd={handleDragEnd}
          whileDrag={{ scale: 0.97 }}
          className="fixed left-4 right-4 z-50 rounded-2xl p-4 flex items-center gap-3 bg-neutral-800 border border-white/10 bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-md cursor-grab active:cursor-grabbing touch-none"
        >
          <img src="/icons/icon-192.png" alt="Swapify" className="w-10 h-10 rounded-xl shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-text-primary">Install Swapify</p>
            <p className="text-sm text-text-secondary truncate">
              Add to your home screen for the best experience
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleDismiss}
              className="text-sm text-text-tertiary px-3 py-1.5 rounded-full hover:text-text-secondary transition-colors"
            >
              Not now
            </button>
            <button onClick={handleInstall} className="btn-pill-primary btn-pill-sm">
              Install
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
