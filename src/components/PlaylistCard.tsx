'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { springs } from '@/lib/motion';

interface PlaylistCardProps {
  playlist: {
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
    members: Array<{
      id: string;
      displayName: string;
      avatarUrl: string | null;
    }>;
  };
}

export default function PlaylistCard({ playlist }: PlaylistCardProps) {
  return (
    <motion.div whileTap={{ scale: 0.98 }} transition={springs.snappy}>
      <Link
        href={`/playlist/${playlist.id}`}
        className="glass rounded-2xl p-3.5 block active:bg-white/6 transition-colors glow-brand-hover"
      >
        <div className="flex items-center gap-3.5">
          {/* Cover image with avatar overlay */}
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
            {/* Unplayed dot indicator */}
            {playlist.unplayedCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-brand border-2 border-background" />
            )}
          </div>

          {/* Info stack */}
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold truncate text-text-primary leading-tight">
              {playlist.name}
            </p>

            {playlist.vibeName && playlist.activeTrackCount > 3 && (
              <p className="text-sm text-brand italic truncate mt-0.5">{playlist.vibeName}</p>
            )}

            {/* Metadata line */}
            <p className="text-sm text-text-tertiary mt-0.5 truncate">
              {playlist.memberCount} member{playlist.memberCount === 1 ? '' : 's'} &middot;{' '}
              {playlist.likedTrackCount}/{playlist.totalTrackCount} liked
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
              {playlist.unplayedCount > 0 && (
                <span className="text-xs font-semibold text-brand">
                  {playlist.unplayedCount} new
                </span>
              )}
            </div>
          </div>

          {/* Chevron */}
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
