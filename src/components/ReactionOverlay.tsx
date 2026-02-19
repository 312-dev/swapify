'use client';

import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { springs, fade } from '@/lib/motion';
import { EmojiStyle, Theme } from 'emoji-picker-react';
import type { EmojiClickData } from 'emoji-picker-react';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

const REACTIONS = [
  { emoji: '👍', value: 'thumbs_up' },
  { emoji: '👎', value: 'thumbs_down' },
  { emoji: '🔥', value: '🔥' },
  { emoji: '❤️', value: '❤️' },
  { emoji: '🎵', value: '🎵' },
];

interface ReactionOverlayProps {
  isOpen: boolean;
  onSelect: (reaction: string) => void;
  onClose: () => void;
  currentReaction?: string | null;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export default function ReactionOverlay({
  isOpen,
  onSelect,
  onClose,
  currentReaction,
  anchorRef,
}: ReactionOverlayProps) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [showPicker, setShowPicker] = useState(false);

  // Compute position from anchor ref and reset expanded state
  useEffect(() => {
    if (!isOpen) {
      setShowPicker(false);
      return;
    }
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPosition({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  }, [isOpen, anchorRef]);

  // Dismiss on scroll
  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = (e: Event) => {
      // Don't close if scrolling inside the overlay (e.g. emoji picker)
      if (bubbleRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    window.addEventListener('scroll', handleScroll, { capture: true });
    return () => window.removeEventListener('scroll', handleScroll, { capture: true });
  }, [isOpen, onClose]);

  const handleEmojiSelect = (emojiData: EmojiClickData) => {
    onSelect(emojiData.emoji);
    onClose();
  };

  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fade}
            onClick={onClose}
          />

          {/* Reaction bubble */}
          <motion.div
            ref={bubbleRef}
            className="fixed z-[61] -translate-x-1/2 -translate-y-full"
            style={{
              top: position.top,
              left: position.left,
            }}
            initial={{ opacity: 0, scale: 0.6, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 8 }}
            transition={springs.snappy}
          >
            <div className="flex flex-col items-center gap-1 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/[0.12] shadow-2xl overflow-hidden">
              <div className="flex items-center gap-1 px-3 pt-2 pb-1">
                {REACTIONS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => {
                      onSelect(currentReaction === r.value ? '' : r.value);
                      onClose();
                    }}
                    className={`text-2xl p-1.5 rounded-xl transition-all hover:bg-white/10 active:scale-90 ${
                      currentReaction === r.value ? 'bg-white/15 ring-1 ring-white/20 scale-110' : ''
                    }`}
                  >
                    {r.emoji}
                  </button>
                ))}
                <button
                  onClick={() => setShowPicker((v) => !v)}
                  className={`text-lg p-1.5 rounded-xl transition-all hover:bg-white/10 active:scale-90 text-white/50 ${
                    showPicker ? 'bg-white/10' : ''
                  }`}
                >
                  +
                </button>
              </div>
              <AnimatePresence>
                {showPicker && (
                  <motion.div
                    className="overflow-hidden"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 350, opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={springs.snappy}
                  >
                    <Suspense
                      fallback={
                        <div className="flex items-center justify-center w-[300px] h-[350px] text-white/40 text-sm">
                          Loading...
                        </div>
                      }
                    >
                      <EmojiPicker
                        onEmojiClick={handleEmojiSelect}
                        theme={Theme.DARK}
                        emojiStyle={EmojiStyle.NATIVE}
                        width={300}
                        height={350}
                        searchPlaceholder="Search emoji..."
                        lazyLoadEmojis
                      />
                    </Suspense>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
