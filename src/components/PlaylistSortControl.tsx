'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { springs } from '@/lib/motion';
import { ArrowUpDown, ArrowUp, ArrowDown, Loader2, X } from 'lucide-react';

export type ClientSortMode =
  | 'default'
  | 'date_asc'
  | 'date_desc'
  | 'energy_asc'
  | 'energy_desc'
  | 'creator_asc'
  | 'creator_desc';

interface SortOption {
  value: ClientSortMode;
  label: string;
  icon?: React.ReactNode;
}

const SORT_OPTIONS: SortOption[] = [
  { value: 'default', label: 'Default' },
  { value: 'date_desc', label: 'Newest First', icon: <ArrowDown className="w-3 h-3" /> },
  { value: 'date_asc', label: 'Oldest First', icon: <ArrowUp className="w-3 h-3" /> },
  { value: 'energy_desc', label: 'Most Energy', icon: <ArrowDown className="w-3 h-3" /> },
  { value: 'energy_asc', label: 'Least Energy', icon: <ArrowUp className="w-3 h-3" /> },
  { value: 'creator_asc', label: 'Creator A\u2192Z', icon: <ArrowDown className="w-3 h-3" /> },
  { value: 'creator_desc', label: 'Creator Z\u2192A', icon: <ArrowUp className="w-3 h-3" /> },
];

interface PlaylistSortControlProps {
  sortMode: ClientSortMode;
  onSortChange: (mode: ClientSortMode) => void;
  loadingEnergy: boolean;
}

export default function PlaylistSortControl({
  sortMode,
  onSortChange,
  loadingEnergy,
}: PlaylistSortControlProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const current = SORT_OPTIONS.find((o) => o.value === sortMode) ?? {
    value: 'default' as const,
    label: 'Default',
  };
  const isActive = sortMode !== 'default';

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={() => setOpen(!open)}
        className={`btn-pill-secondary btn-pill-sm gap-1.5 text-xs ${
          isActive ? 'border-brand/40! text-brand!' : ''
        }`}
      >
        {loadingEnergy ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <ArrowUpDown className="w-3 h-3" />
        )}
        {current.label}
      </button>

      {/* Reset button */}
      {isActive && (
        <button
          onClick={() => onSortChange('default')}
          className="ml-1 p-1 rounded-full text-text-tertiary hover:text-text-primary hover:bg-white/10 transition-colors"
          aria-label="Reset sort"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={springs.snappy}
            className="absolute top-full left-0 mt-2 w-48 glass rounded-xl border border-white/10 py-1 z-50 shadow-xl"
          >
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onSortChange(option.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                  sortMode === option.value
                    ? 'text-brand bg-brand/10'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                }`}
              >
                {option.icon && <span className="opacity-60">{option.icon}</span>}
                {option.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
