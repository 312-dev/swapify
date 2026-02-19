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
    memberCount: number;
    activeTrackCount: number;
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
        className="glass rounded-2xl p-3 block hover:bg-glass-hover transition-colors"
      >
        <div className="flex items-center gap-4">
          {/* Cover image */}
          <div className="w-16 h-16 rounded-xl shrink-0 overflow-hidden">
            {playlist.imageUrl ? (
              <img
                src={playlist.imageUrl}
                alt={playlist.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-spotify/20 to-spotify/5">
                <svg className="w-7 h-7 text-spotify/60" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6ZM10 19a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
                </svg>
              </div>
            )}
          </div>

          {/* Info stack */}
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold truncate text-text-primary">{playlist.name}</p>
            {playlist.description && (
              <p className="text-base text-text-secondary truncate mt-0.5">
                {playlist.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2">
              {/* Avatar stack */}
              <div className="avatar-stack flex">
                {playlist.members.slice(0, 3).map((member) =>
                  member.avatarUrl ? (
                    <img
                      key={member.id}
                      src={member.avatarUrl}
                      alt={member.displayName}
                      className="w-5 h-5 rounded-full object-cover"
                      data-tooltip={member.displayName}
                    />
                  ) : (
                    <div
                      key={member.id}
                      className="w-5 h-5 rounded-full bg-border flex items-center justify-center text-[8px] text-text-secondary"
                      data-tooltip={member.displayName}
                    >
                      {member.displayName[0]}
                    </div>
                  )
                )}
                {playlist.memberCount > 3 && (
                  <div
                    className="w-5 h-5 rounded-full bg-border flex items-center justify-center text-[8px] text-text-tertiary"
                    data-tooltip={`${playlist.memberCount - 3} more`}
                  >
                    +{playlist.memberCount - 3}
                  </div>
                )}
              </div>
              {/* Unplayed badge */}
              {playlist.unplayedCount > 0 ? (
                <span className="unread-badge min-w-5 h-5 px-1.5 rounded-full bg-spotify text-black text-xs font-bold flex items-center justify-center">
                  {playlist.unplayedCount} new
                </span>
              ) : (
                <span className="text-sm text-text-tertiary">No new tracks</span>
              )}
            </div>
          </div>

          {/* Chevron */}
          <div className="shrink-0">
            <svg
              className="w-5 h-5 text-text-tertiary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
