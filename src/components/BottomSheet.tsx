"use client";

import { type ReactNode, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** "half" snaps to ~50vh, "full" snaps to ~90vh. Default: "full" */
  snapPoint?: "half" | "full";
}

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  snapPoint = "full",
}: BottomSheetProps) {
  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="bottom-sheet-backdrop"
            className="fixed inset-0 z-[59] bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="bottom-sheet-panel"
            className="fixed bottom-0 left-0 right-0 z-[60] bg-surface border-t border-white/[0.08] rounded-t-[20px] overflow-y-auto"
            style={{ maxHeight: snapPoint === "half" ? "50vh" : "90vh" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_event, info) => {
              if (info.velocity.y > 300 || info.offset.y > 150) {
                onClose();
              }
            }}
          >
            {/* Handle bar */}
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-2" />

            {/* Title */}
            {title && (
              <h2 className="text-lg font-bold text-center mb-4 px-6">
                {title}
              </h2>
            )}

            {/* Content */}
            <div className="px-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
