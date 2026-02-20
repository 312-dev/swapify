'use client';

import { motion } from 'motion/react';
import { springs } from '@/lib/motion';
import { Music, ThumbsUp, ThumbsDown } from 'lucide-react';

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
            <span className="relative z-10 flex items-center justify-center gap-1.5 leading-none">
              {isInbox && <Music className="w-3.5 h-3.5 shrink-0" />}
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
