'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { m, AnimatePresence } from 'motion/react';
import { ChevronRight, X, ExternalLink } from 'lucide-react';
import { springs, STAGGER_DELAY } from '@/lib/motion';
import { useUnreadActivity } from '@/components/UnreadActivityProvider';
import AlbumArt from '@/components/AlbumArt';
import type { ActivityEvent } from '@/app/api/activity/route';

const REACTION_EMOJI: Record<string, string> = {
  thumbs_up: '\uD83D\uDC4D',
  thumbs_down: '\uD83D\uDC4E',
  fire: '\uD83D\uDD25',
  heart: '\u2764\uFE0F',
};

function reactionToEmoji(reaction: string): string {
  return REACTION_EMOJI[reaction] ?? reaction;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getEventRingColor(type: string): string {
  switch (type) {
    case 'track_added':
      return 'ring-green-400/50';
    case 'reaction':
      return 'ring-amber-400/50';
    case 'member_joined':
    case 'circle_joined':
      return 'ring-sky-400/50';
    case 'track_removed':
      return 'ring-red-400/30';
    case 'swaplist_created':
    case 'circle_created':
      return 'ring-purple-400/50';
    default:
      return 'ring-white/10';
  }
}

function getEventTextColor(type: string): string {
  switch (type) {
    case 'track_added':
      return 'text-green-400';
    case 'reaction':
      return 'text-amber-400';
    case 'member_joined':
    case 'circle_joined':
      return 'text-sky-400';
    case 'track_removed':
      return 'text-red-400/70';
    case 'swaplist_created':
    case 'circle_created':
      return 'text-purple-400';
    default:
      return 'text-text-tertiary';
  }
}

function getEventBgAccent(type: string): string {
  switch (type) {
    case 'track_added':
      return 'bg-green-400/8';
    case 'reaction':
      return 'bg-amber-400/8';
    case 'member_joined':
    case 'circle_joined':
      return 'bg-sky-400/8';
    case 'track_removed':
      return 'bg-red-400/5';
    case 'swaplist_created':
    case 'circle_created':
      return 'bg-purple-400/8';
    default:
      return 'bg-white/5';
  }
}

function getEventLabel(event: ActivityEvent): { emoji: string; text: string } {
  switch (event.type) {
    case 'track_added':
      return { emoji: '\uD83C\uDFB5', text: 'added' };
    case 'reaction':
      return { emoji: reactionToEmoji(event.data.reaction ?? ''), text: 'reacted' };
    case 'member_joined':
      return { emoji: '\uD83D\uDC4B', text: 'joined' };
    case 'track_removed':
      return { emoji: '', text: 'removed' };
    case 'swaplist_created':
      return { emoji: '\u2728', text: 'new list' };
    case 'circle_joined':
      return { emoji: '\uD83D\uDC4B', text: 'joined' };
    case 'circle_created':
      return { emoji: '\u2728', text: 'new circle' };
    default:
      return { emoji: '', text: '' };
  }
}

function getDetailDescription(event: ActivityEvent): string {
  switch (event.type) {
    case 'track_added':
      return `Added a track to ${event.data.playlistName ?? 'a swaplist'}`;
    case 'reaction':
      return `Reacted ${reactionToEmoji(event.data.reaction ?? '')} to \u201c${event.data.trackName}\u201d`;
    case 'member_joined':
      return `Joined ${event.data.playlistName ?? 'a swaplist'}`;
    case 'track_removed':
      return `Removed \u201c${event.data.trackName}\u201d from ${event.data.playlistName ?? 'a swaplist'}`;
    case 'swaplist_created':
      return `Created a new swaplist`;
    case 'circle_joined':
      return `Joined ${event.data.circleName ?? 'your circle'}`;
    case 'circle_created':
      return `Created ${event.data.circleName ?? 'a new circle'}`;
    default:
      return '';
  }
}

function getListDescription(event: ActivityEvent): string {
  switch (event.type) {
    case 'track_added':
      return `${event.data.trackName} \u00b7 ${event.data.artistName}`;
    case 'reaction':
      return `reacted ${reactionToEmoji(event.data.reaction ?? '')} to \u201c${event.data.trackName}\u201d`;
    case 'member_joined':
      return `joined ${event.data.playlistName}`;
    case 'track_removed':
      return `removed \u201c${event.data.trackName}\u201d`;
    case 'swaplist_created':
      return `created \u201c${event.data.playlistName}\u201d`;
    case 'circle_joined':
      return `joined ${event.data.circleName ?? 'your circle'}`;
    case 'circle_created':
      return `created ${event.data.circleName ?? 'a circle'}`;
    default:
      return '';
  }
}

// --- Bubble (horizontal scroll item) ---

function EventBubble({
  event,
  index,
  onSelect,
}: Readonly<{ event: ActivityEvent; index: number; onSelect: (e: ActivityEvent) => void }>) {
  const ringColor = getEventRingColor(event.type);
  const textColor = getEventTextColor(event.type);
  const label = getEventLabel(event);
  const firstName = event.user.displayName.split(' ')[0];
  const isRemoved = event.type === 'track_removed';
  const showAlbumArt = event.type === 'track_added' && event.data.albumImageUrl;

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...springs.gentle, delay: index * STAGGER_DELAY }}
      className="shrink-0"
    >
      <button
        onClick={() => onSelect(event)}
        className={`flex flex-col items-center gap-1 w-[68px] ${isRemoved ? 'opacity-50' : ''}`}
      >
        <div className="relative">
          {showAlbumArt ? (
            <img
              src={event.data.albumImageUrl!}
              alt=""
              className={`w-12 h-12 rounded-2xl object-cover ring-2 ${ringColor}`}
            />
          ) : event.user.avatarUrl ? (
            <img
              src={event.user.avatarUrl}
              alt={event.user.displayName}
              className={`w-12 h-12 rounded-full object-cover ring-2 ${ringColor}`}
            />
          ) : (
            <div
              className={`w-12 h-12 rounded-full bg-white/10 ring-2 ${ringColor} flex items-center justify-center text-base font-semibold text-text-secondary`}
            >
              {event.user.displayName[0]}
            </div>
          )}
          {label.emoji && (
            <span className="absolute -bottom-1 -right-1 text-xs leading-none bg-[var(--background)] rounded-full p-0.5">
              {label.emoji}
            </span>
          )}
        </div>
        <p className="text-[11px] font-medium text-text-primary truncate w-full text-center leading-tight">
          {firstName}
        </p>
        <p className={`text-[10px] ${textColor} truncate w-full text-center leading-tight`}>
          {label.text} &middot; {formatTimeAgo(new Date(event.timestamp))}
        </p>
      </button>
    </m.div>
  );
}

// --- Detail Card (single event overlay) ---

function DetailCard({ event, onClose }: Readonly<{ event: ActivityEvent; onClose: () => void }>) {
  const router = useRouter();
  const textColor = getEventTextColor(event.type);
  const bgAccent = getEventBgAccent(event.type);
  const label = getEventLabel(event);
  const description = getDetailDescription(event);
  const href = event.data.playlistId ? `/playlist/${event.data.playlistId}` : '/dashboard';

  const hasTrackInfo =
    event.type === 'track_added' || event.type === 'reaction' || event.type === 'track_removed';

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <m.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={springs.snappy}
        className="relative w-full max-w-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`relative rounded-2xl border border-white/8 ${bgAccent} bg-surface backdrop-blur-2xl shadow-2xl`}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-text-secondary" />
          </button>

          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 pr-8">
              {event.user.avatarUrl ? (
                <img
                  src={event.user.avatarUrl}
                  alt={event.user.displayName}
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold text-text-secondary shrink-0">
                  {event.user.displayName[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">
                  {event.user.displayName}
                </p>
                <p className="text-xs text-text-tertiary">
                  {formatTimeAgo(new Date(event.timestamp))} ago
                </p>
              </div>
            </div>

            {hasTrackInfo && event.data.trackName && (
              <div className="flex items-center gap-3">
                {event.data.albumImageUrl && (
                  <AlbumArt
                    src={event.data.albumImageUrl}
                    alt=""
                    className="w-14 h-14 rounded-xl"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-text-primary truncate">
                    {event.data.trackName}
                  </p>
                  {event.data.artistName && (
                    <p className="text-sm text-text-secondary truncate">{event.data.artistName}</p>
                  )}
                </div>
              </div>
            )}

            <p className={`text-sm ${textColor} leading-relaxed`}>
              {label.emoji && <span className="mr-1">{label.emoji}</span>}
              {description}
            </p>

            {event.data.playlistName && (
              <p className="text-xs text-text-tertiary truncate">
                {'\uD83C\uDFB5'} {event.data.playlistName}
              </p>
            )}

            <button
              onClick={() => {
                onClose();
                router.push(href);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/8 hover:bg-white/12 transition-colors py-2.5 text-sm font-medium text-text-primary"
            >
              {event.data.playlistId ? 'Go to swaplist' : 'Go to dashboard'}
              <ExternalLink className="w-3.5 h-3.5 text-text-tertiary" />
            </button>
          </div>
        </div>
      </m.div>
    </m.div>
  );
}

// --- All Activity list modal ---

function AllActivityModal({ onClose }: Readonly<{ onClose: () => void }>) {
  const router = useRouter();
  const [allEvents, setAllEvents] = useState<ActivityEvent[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);

  useEffect(() => {
    fetch('/api/activity?limit=30')
      .then((res) => res.json())
      .then((data) => {
        setAllEvents(data.events || []);
        setLoadingAll(false);
      })
      .catch(() => setLoadingAll(false));
  }, []);

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <m.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={springs.snappy}
        className="relative w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative rounded-t-2xl sm:rounded-2xl border border-white/8 bg-surface backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
            <h2 className="text-lg font-bold text-text-primary">Activity</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-text-secondary" />
            </button>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-2">
            {loadingAll ? (
              <div className="space-y-1">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-2 py-3">
                    <div className="w-9 h-9 rounded-full skeleton shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 skeleton w-1/3 rounded" />
                      <div className="h-3 skeleton w-2/3 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : allEvents.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-text-tertiary">No recent activity</p>
              </div>
            ) : (
              <div>
                {allEvents.map((event, i) => {
                  const textColor = getEventTextColor(event.type);
                  const label = getEventLabel(event);
                  const desc = getListDescription(event);
                  const href = event.data.playlistId
                    ? `/playlist/${event.data.playlistId}`
                    : '/dashboard';
                  const isRemoved = event.type === 'track_removed';
                  const showAlbumArt = event.type === 'track_added' && event.data.albumImageUrl;

                  return (
                    <m.div
                      key={event.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...springs.gentle, delay: i * 0.03 }}
                    >
                      <button
                        onClick={() => {
                          onClose();
                          router.push(href);
                        }}
                        className={`w-full flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-white/5 transition-colors text-left ${
                          isRemoved ? 'opacity-50' : ''
                        }`}
                      >
                        {/* Avatar */}
                        {event.user.avatarUrl ? (
                          <img
                            src={event.user.avatarUrl}
                            alt={event.user.displayName}
                            className="w-9 h-9 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-medium text-text-secondary shrink-0">
                            {event.user.displayName[0]}
                          </div>
                        )}

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-text-primary truncate">
                              {event.user.displayName}
                            </p>
                            <span className="text-xs text-text-tertiary shrink-0">
                              {formatTimeAgo(new Date(event.timestamp))}
                            </span>
                          </div>
                          <p className={`text-xs ${textColor} truncate mt-0.5`}>
                            {label.emoji && <span className="mr-1">{label.emoji}</span>}
                            {desc}
                          </p>
                        </div>

                        {/* Album art for track events */}
                        {showAlbumArt && (
                          <AlbumArt
                            src={event.data.albumImageUrl!}
                            alt=""
                            className="w-9 h-9 rounded-lg shrink-0"
                          />
                        )}
                      </button>
                    </m.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </m.div>
    </m.div>
  );
}

// --- Main feed ---

export default function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { unreadCount, markRead } = useUnreadActivity();
  const [selectedEvent, setSelectedEvent] = useState<ActivityEvent | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch('/api/activity?limit=5')
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Mark as read when visible (always visible, no collapse)
  useEffect(() => {
    if (!loading && events.length > 0 && unreadCount > 0) {
      const timer = setTimeout(() => markRead(), 1000);
      return () => clearTimeout(timer);
    }
  }, [loading, events.length, unreadCount, markRead]);

  const handleCloseDetail = useCallback(() => setSelectedEvent(null), []);
  const handleCloseAll = useCallback(() => setShowAll(false), []);

  // Hide section entirely when empty
  if (!loading && events.length === 0) return null;

  return (
    <section className="relative z-1 pt-3 pb-1">
      <div className="flex items-start gap-3 overflow-x-auto scrollbar-none px-5 py-1">
        {loading
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} className="shrink-0 flex flex-col items-center gap-1.5 w-[68px]">
                <div className="w-12 h-12 rounded-full skeleton" />
                <div className="h-2.5 skeleton w-10 rounded" />
                <div className="h-2 skeleton w-8 rounded" />
              </div>
            ))
          : events.map((event, i) => (
              <EventBubble key={event.id} event={event} index={i} onSelect={setSelectedEvent} />
            ))}

        {/* "See all" button */}
        {!loading && events.length > 0 && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...springs.gentle, delay: events.length * STAGGER_DELAY }}
            className="shrink-0"
          >
            <button
              onClick={() => setShowAll(true)}
              className="flex flex-col items-center gap-1 w-[68px]"
            >
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                <ChevronRight className="w-5 h-5 text-text-tertiary" />
              </div>
              <p className="text-[11px] font-medium text-text-tertiary text-center leading-tight">
                See all
              </p>
            </button>
          </m.div>
        )}
      </div>

      {/* Portaled overlays */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {selectedEvent && <DetailCard event={selectedEvent} onClose={handleCloseDetail} />}
            {showAll && <AllActivityModal onClose={handleCloseAll} />}
          </AnimatePresence>,
          document.body
        )}
    </section>
  );
}
