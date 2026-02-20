'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { springs, STAGGER_DELAY } from '@/lib/motion';
import Link from 'next/link';
import AlbumArt from '@/components/AlbumArt';
import { useUnreadActivity } from '@/components/UnreadActivityProvider';

interface ActivityEvent {
  id: string;
  type: 'track_added';
  timestamp: string;
  user: {
    displayName: string;
    avatarUrl: string | null;
  };
  data: {
    trackName: string;
    artistName: string;
    albumImageUrl: string | null;
    playlistName: string;
    playlistId: string;
  };
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function groupByDate(events: ActivityEvent[]): { label: string; events: ActivityEvent[] }[] {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: Record<string, ActivityEvent[]> = {};

  for (const event of events) {
    const date = new Date(event.timestamp);
    let label: string;
    if (date.toDateString() === today.toDateString()) label = 'Today';
    else if (date.toDateString() === yesterday.toDateString()) label = 'Yesterday';
    else label = 'Earlier';

    if (!groups[label]) groups[label] = [];
    groups[label]!.push(event);
  }

  const order = ['Today', 'Yesterday', 'Earlier'];
  return order.filter((l) => groups[l]).map((label) => ({ label, events: groups[label]! }));
}

export default function ActivityClient() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { markRead } = useUnreadActivity();

  useEffect(() => {
    fetch('/api/activity')
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    markRead();
  }, [markRead]);

  const grouped = groupByDate(events);

  return (
    <div className="min-h-screen">
      <div className="px-5 pt-8 pb-4">
        <h1 className="text-3xl font-bold text-text-primary">Activity</h1>
        <p className="text-base text-text-secondary mt-1">Recent updates across your Swaplists</p>
      </div>

      {loading ? (
        <div className="px-5 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <div className="w-10 h-10 rounded-full skeleton" />
              <div className="flex-1 space-y-2">
                <div className="h-3 skeleton w-3/4" />
                <div className="h-2.5 skeleton w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 px-6">
          <svg
            className="w-16 h-16 text-text-tertiary mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <h2 className="text-xl font-semibold text-text-primary">No activity yet</h2>
          <p className="text-base text-text-secondary mt-2">
            Activity from your Swaplists will show up here.
          </p>
        </div>
      ) : (
        <div className="px-4">
          {grouped.map((group) => (
            <div key={group.label} className="mb-6">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider px-1 mb-2">
                {group.label}
              </h3>
              <div className="space-y-1">
                {group.events.map((event, i) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springs.gentle, delay: i * STAGGER_DELAY }}
                  >
                    <Link
                      href={`/playlist/${event.data.playlistId}`}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors"
                    >
                      {/* User avatar */}
                      {event.user.avatarUrl ? (
                        <img
                          src={event.user.avatarUrl}
                          alt={event.user.displayName}
                          className="w-10 h-10 rounded-full shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-base text-text-secondary shrink-0">
                          {event.user.displayName[0]}
                        </div>
                      )}

                      {/* Event text */}
                      <div className="flex-1 min-w-0">
                        <p className="text-base text-text-primary">
                          <span className="font-semibold">{event.user.displayName}</span>
                          {' added '}
                          <span className="font-semibold">{event.data.trackName}</span>
                        </p>
                        <p className="text-sm text-text-tertiary truncate">
                          {event.data.artistName} · {event.data.playlistName} ·{' '}
                          {formatTimeAgo(new Date(event.timestamp))}
                        </p>
                      </div>

                      {/* Album art */}
                      {event.data.albumImageUrl && (
                        <AlbumArt
                          src={event.data.albumImageUrl}
                          alt=""
                          className="w-10 h-10 rounded-lg shrink-0"
                        />
                      )}
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
