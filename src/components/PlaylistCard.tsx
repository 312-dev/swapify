'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { springs } from '@/lib/motion';
import { useCardTint } from '@/hooks/useAlbumColors';

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export interface PlaylistData {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  vibeName: string | null;
  memberCount: number;
  activeTrackCount: number;
  totalTrackCount: number;
  likedTrackCount: number;
  unplayedCount: number;
  lastUpdatedAt: string | null;
  isMember?: boolean;
  members: Array<{
    id: string;
    displayName: string;
    avatarUrl: string | null;
  }>;
}

interface PlaylistCardProps {
  playlist: PlaylistData;
  variant?: 'list' | 'carousel' | 'grid';
  onJoin?: (playlistId: string) => void;
  joiningId?: string | null;
}

function CardContent({
  playlist,
  tint,
}: {
  playlist: PlaylistCardProps['playlist'];
  tint: ReturnType<typeof useCardTint>;
}) {
  return (
    <>
      {/* Color tint from album art */}
      {tint.background && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: tint.background }}
        />
      )}
      <div className="flex items-center gap-3.5 relative">
        {/* Cover image */}
        <div className="relative w-14 h-14 shrink-0">
          <div className="w-14 h-14 rounded-lg overflow-hidden">
            {playlist.imageUrl ? (
              <img
                src={playlist.imageUrl}
                alt={playlist.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-brand/20 to-brand/5">
                <svg className="w-6 h-6 text-brand/60" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6ZM10 19a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
                </svg>
              </div>
            )}
          </div>
          {/* Unplayed dot indicator (members only) */}
          {playlist.isMember !== false && playlist.unplayedCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-brand border-2 border-background" />
          )}
        </div>

        {/* Info stack */}
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold truncate text-text-primary leading-tight">
            {playlist.name}
          </p>

          {playlist.vibeName && playlist.activeTrackCount > 3 && (
            <p
              className="text-sm italic truncate mt-0.5"
              style={tint.vibeColor ? { color: tint.vibeColor } : undefined}
            >
              {playlist.vibeName}
            </p>
          )}

          {/* Metadata line */}
          <p className="text-sm text-text-tertiary mt-0.5 truncate">
            {playlist.activeTrackCount} track{playlist.activeTrackCount === 1 ? '' : 's'}
            {playlist.isMember !== false && playlist.unplayedCount > 0 && (
              <span className="text-brand font-medium">
                {' '}
                &middot; {playlist.unplayedCount} unheard
              </span>
            )}
            {playlist.lastUpdatedAt && <span> &middot; {timeAgo(playlist.lastUpdatedAt)}</span>}
          </p>

          {/* Avatar stack + new badge */}
          <div className="flex items-center gap-2 mt-1.5">
            <div className="avatar-stack flex">
              {playlist.members.slice(0, 4).map((member) =>
                member.avatarUrl ? (
                  <img
                    key={member.id}
                    src={member.avatarUrl}
                    alt={member.displayName}
                    className="w-6 h-6 rounded-full object-cover"
                    data-tooltip={member.displayName}
                  />
                ) : (
                  <div
                    key={member.id}
                    className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-medium text-text-secondary"
                    data-tooltip={member.displayName}
                  >
                    {member.displayName[0]}
                  </div>
                )
              )}
              {playlist.memberCount > 4 && (
                <div
                  className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-medium text-text-tertiary"
                  data-tooltip={`${playlist.memberCount - 4} more`}
                >
                  +{playlist.memberCount - 4}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function CarouselCard({ playlist }: { playlist: PlaylistData }) {
  const tint = useCardTint(playlist.imageUrl);

  const inner = (
    <div className="w-40 shrink-0 snap-start">
      {/* Cover art */}
      <div className="relative w-40 h-40 rounded-xl overflow-hidden mb-2">
        {playlist.imageUrl ? (
          <img src={playlist.imageUrl} alt={playlist.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-brand/20 to-brand/5">
            <svg className="w-10 h-10 text-brand/60" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6ZM10 19a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
            </svg>
          </div>
        )}
        {/* Unplayed badge */}
        {playlist.isMember !== false && playlist.unplayedCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-5 h-5 px-1 flex items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white leading-none shadow-lg">
            {playlist.unplayedCount}
          </span>
        )}
        {/* Subtle tint overlay */}
        {tint.background && (
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{ background: tint.background }}
          />
        )}
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-text-primary truncate leading-tight">
        {playlist.name}
      </p>

      {/* Subtitle line */}
      <p className="text-xs text-text-tertiary truncate mt-0.5">
        {playlist.activeTrackCount} track{playlist.activeTrackCount === 1 ? '' : 's'}
      </p>

      {/* Mini avatar stack */}
      <div className="flex items-center mt-1.5 -space-x-1">
        {playlist.members.slice(0, 3).map((member) =>
          member.avatarUrl ? (
            <img
              key={member.id}
              src={member.avatarUrl}
              alt={member.displayName}
              className="w-5 h-5 rounded-full object-cover ring-1 ring-background"
            />
          ) : (
            <div
              key={member.id}
              className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-medium text-text-secondary ring-1 ring-background"
            >
              {member.displayName[0]}
            </div>
          )
        )}
        {playlist.memberCount > 3 && (
          <span className="text-[10px] text-text-tertiary ml-1.5">+{playlist.memberCount - 3}</span>
        )}
      </div>
    </div>
  );

  if (playlist.isMember === false) {
    return inner;
  }

  return (
    <motion.div whileTap={{ scale: 0.97 }} transition={springs.snappy}>
      <Link href={`/playlist/${playlist.id}`}>{inner}</Link>
    </motion.div>
  );
}

function GridCard({
  playlist,
  onJoin,
  joiningId,
}: {
  playlist: PlaylistData;
  onJoin?: (id: string) => void;
  joiningId?: string | null;
}) {
  const tint = useCardTint(playlist.imageUrl);
  const isJoining = joiningId === playlist.id;

  const inner = (
    <div className="relative">
      {/* Cover art — square, compact */}
      <div className="relative aspect-square rounded-lg overflow-hidden mb-1.5">
        {playlist.imageUrl ? (
          <img src={playlist.imageUrl} alt={playlist.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-brand/20 to-brand/5">
            <svg className="w-6 h-6 text-brand/60" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6ZM10 19a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
            </svg>
          </div>
        )}
        {/* Unplayed badge */}
        {playlist.isMember !== false && playlist.unplayedCount > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-0.5 flex items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white leading-none shadow-lg">
            {playlist.unplayedCount}
          </span>
        )}
        {/* Subtle tint overlay */}
        {tint.background && (
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{ background: tint.background }}
          />
        )}
        {/* Join button overlay for non-members */}
        {playlist.isMember === false && onJoin && (
          <div className="absolute bottom-1.5 right-1.5">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onJoin(playlist.id);
              }}
              disabled={isJoining}
              className="btn-pill btn-pill-primary text-[10px] px-2 py-0.5 disabled:opacity-50 shadow-lg"
            >
              {isJoining ? (
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                'Join'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-text-primary truncate leading-tight">
        {playlist.name}
      </p>

      {/* Metadata */}
      <p className="text-xs text-text-tertiary truncate mt-0.5">
        {playlist.activeTrackCount} track{playlist.activeTrackCount === 1 ? '' : 's'}
        {playlist.isMember !== false && playlist.unplayedCount > 0 && (
          <span className="text-brand font-medium"> &middot; {playlist.unplayedCount} new</span>
        )}
      </p>
      {playlist.lastUpdatedAt && (
        <p className="text-[10px] text-text-tertiary truncate mt-0.5">
          {timeAgo(playlist.lastUpdatedAt)}
        </p>
      )}
    </div>
  );

  if (playlist.isMember === false) {
    return inner;
  }

  return (
    <motion.div whileTap={{ scale: 0.97 }} transition={springs.snappy}>
      <Link href={`/playlist/${playlist.id}`}>{inner}</Link>
    </motion.div>
  );
}

export default function PlaylistCard({
  playlist,
  variant = 'list',
  onJoin,
  joiningId,
}: PlaylistCardProps) {
  const tint = useCardTint(playlist.imageUrl);
  const isJoining = joiningId === playlist.id;

  // Carousel variant — vertical card (horizontal scroll)
  if (variant === 'carousel') {
    return <CarouselCard playlist={playlist} />;
  }

  // Grid variant — square card for 2-col grid
  if (variant === 'grid') {
    return <GridCard playlist={playlist} onJoin={onJoin} joiningId={joiningId} />;
  }

  // Non-member variant: show Join button instead of link
  if (playlist.isMember === false) {
    return (
      <motion.div whileTap={{ scale: 0.98 }} transition={springs.snappy}>
        <div className="glass rounded-2xl p-3.5 block overflow-hidden relative opacity-75">
          <CardContent playlist={playlist} tint={tint} />
          {/* Join button overlay on the right */}
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
            <button
              onClick={() => onJoin?.(playlist.id)}
              disabled={isJoining}
              className="btn-pill btn-pill-primary text-xs px-3.5 py-1.5 disabled:opacity-50"
            >
              {isJoining ? (
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                'Join'
              )}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Member variant: clickable link to playlist
  return (
    <motion.div whileTap={{ scale: 0.98 }} transition={springs.snappy}>
      <Link
        href={`/playlist/${playlist.id}`}
        className="glass rounded-2xl p-3.5 block active:bg-white/6 transition-colors glow-brand-hover overflow-hidden relative"
      >
        <CardContent playlist={playlist} tint={tint} />
        {/* Chevron */}
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
          <svg
            className="w-4 h-4 text-text-tertiary shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>
      </Link>
    </motion.div>
  );
}
