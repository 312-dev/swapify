'use client';

import { motion } from 'motion/react';
import { springs } from '@/lib/motion';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

function ShareSongIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" className={className}>
      <g transform="translate(0,512) scale(0.1,-0.1)">
        <path d="M1483 5105 c-170 -46 -304 -181 -348 -350 -12 -47 -15 -123 -15 -372 l0 -313 -47 23 c-100 50 -152 62 -273 62 -94 0 -128 -4 -185 -23 -109 -36 -193 -88 -271 -167 -244 -247 -244 -643 1 -891 254 -257 657 -258 907 -1 l48 48 872 -386 873 -387 2 -111 c1 -62 3 -123 5 -137 3 -23 -51 -54 -802 -471 l-805 -447 -3 304 c-3 341 -1 351 64 400 l37 29 217 5 217 5 37 29 c71 54 85 151 32 221 -46 59 -72 65 -293 65 -217 0 -285 -11 -375 -56 -71 -36 -159 -123 -197 -193 -56 -106 -61 -143 -61 -488 l0 -313 -47 23 c-100 50 -152 62 -273 62 -94 0 -128 -4 -185 -23 -109 -36 -193 -88 -271 -167 -247 -249 -244 -645 6 -896 315 -316 845 -219 1032 190 39 85 58 189 58 324 l1 112 886 491 886 491 61 -49 c221 -179 520 -194 759 -39 117 77 203 189 255 333 l26 73 4 383 3 382 193 0 c258 0 332 22 455 136 113 104 169 270 144 419 -33 195 -192 359 -382 395 -80 15 -286 12 -359 -5 -175 -41 -311 -175 -357 -350 -12 -47 -15 -123 -15 -372 l0 -313 -42 21 c-213 109 -468 84 -665 -65 -35 -26 -73 -61 -87 -78 l-23 -30 -644 285 c-354 156 -749 331 -877 388 l-234 104 6 35 c3 19 6 187 6 373 l0 337 183 0 c200 0 271 11 359 56 65 33 164 132 200 200 145 271 -6 610 -307 689 -77 20 -318 20 -392 0z" />
      </g>
    </svg>
  );
}

type Tab = 'inbox' | 'liked' | 'outcasts';

interface PlaylistTabsProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  inboxCount: number;
  likedCount: number;
  outcastCount: number;
}

const tabs: { id: Tab; label: string; countKey?: 'inboxCount' | 'likedCount' | 'outcastCount' }[] =
  [
    { id: 'inbox', label: 'Swaplist', countKey: 'inboxCount' },
    { id: 'liked', label: 'Liked', countKey: 'likedCount' },
    { id: 'outcasts', label: 'Outcasts', countKey: 'outcastCount' },
  ];

export default function PlaylistTabs({
  activeTab,
  onTabChange,
  inboxCount,
  likedCount,
  outcastCount,
}: PlaylistTabsProps) {
  const counts = { inboxCount, likedCount, outcastCount };

  return (
    <div className="flex items-center gap-1 mx-5 mt-4 p-1 rounded-xl glass">
      {tabs.map((tab) => {
        const count = tab.countKey ? counts[tab.countKey] : 0;
        const isActive = activeTab === tab.id;
        const isInbox = tab.id === 'inbox';
        const hasInboxItems = isInbox && count > 0;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative flex-1 flex items-center justify-center py-2.5 text-sm font-semibold rounded-lg transition-colors ${
              isActive || hasInboxItems ? 'text-text-primary' : 'text-text-tertiary'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="playlist-tab-indicator"
                className="absolute inset-0 rounded-lg bg-white/10"
                transition={springs.snappy}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-1.5">
              {isInbox && <ShareSongIcon className="w-3.5 h-3.5 shrink-0" />}
              {tab.id === 'liked' && <ThumbsUp className="w-3.5 h-3.5 shrink-0" />}
              {tab.id === 'outcasts' && <ThumbsDown className="w-3.5 h-3.5 shrink-0" />}
              {tab.label}
              {isInbox && count > 0 && (
                <span className="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1 text-[11px] font-bold rounded-full bg-brand text-black leading-none">
                  {count}
                </span>
              )}
              {!isInbox && count > 0 && <span className="text-xs opacity-60">{count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
