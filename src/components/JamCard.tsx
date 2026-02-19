"use client";

import Link from "next/link";
import { motion } from "motion/react";

interface JamCardProps {
  jam: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    memberCount: number;
    activeTrackCount: number;
    members: Array<{
      id: string;
      displayName: string;
      avatarUrl: string | null;
    }>;
  };
}

export default function JamCard({ jam }: JamCardProps) {
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <Link
        href={`/jam/${jam.id}`}
        className="glass rounded-2xl p-3 block hover:bg-glass-hover transition-colors"
      >
        <div className="flex items-center gap-4">
          {/* Cover image */}
          <div className="w-16 h-16 rounded-xl shrink-0 overflow-hidden">
            {jam.imageUrl ? (
              <img
                src={jam.imageUrl}
                alt={jam.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-spotify/20 to-spotify/5">
                <svg
                  className="w-7 h-7 text-spotify/60"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6ZM10 19a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
                </svg>
              </div>
            )}
          </div>

          {/* Info stack */}
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold truncate text-text-primary">
              {jam.name}
            </p>
            {jam.description && (
              <p className="text-sm text-text-secondary truncate mt-0.5">
                {jam.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2">
              {/* Avatar stack */}
              <div className="avatar-stack flex">
                {jam.members.slice(0, 3).map((member) =>
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
                {jam.memberCount > 3 && (
                  <div
                    className="w-5 h-5 rounded-full bg-border flex items-center justify-center text-[8px] text-text-tertiary"
                    data-tooltip={`${jam.memberCount - 3} more`}
                  >
                    +{jam.memberCount - 3}
                  </div>
                )}
              </div>
              {/* Track count */}
              <span className="text-xs text-text-tertiary">
                {jam.activeTrackCount} track
                {jam.activeTrackCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Chevron */}
          <svg
            className="w-5 h-5 text-text-tertiary shrink-0"
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
      </Link>
    </motion.div>
  );
}
