"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, m } from "motion/react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed or previously dismissed this session
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
    setDismissed(true);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setDeferredPrompt(null);
  }, []);

  const show = deferredPrompt && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <m.div
          initial={{ opacity: 0, y: 72 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 72 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-24 left-4 right-4 z-50 glass rounded-2xl p-4 flex items-center gap-3"
        >
          <img
            src="/icons/icon-192.png"
            alt="Deep Digs"
            className="w-10 h-10 rounded-xl shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary">
              Install Deep Digs
            </p>
            <p className="text-xs text-text-secondary truncate">
              Add to your home screen for the best experience
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleDismiss}
              className="text-xs text-text-tertiary px-3 py-1.5 rounded-full hover:text-text-secondary transition-colors"
            >
              Not now
            </button>
            <button
              onClick={handleInstall}
              className="btn-pill-primary !text-xs !px-4 !py-1.5"
            >
              Install
            </button>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
