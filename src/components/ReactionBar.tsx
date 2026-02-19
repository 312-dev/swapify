"use client";

import { useState } from "react";

interface Reaction {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  reaction: string;
  isAuto: boolean;
  createdAt: string;
}

interface ReactionBarProps {
  reactions: Reaction[];
  jamId: string;
  spotifyTrackId: string;
  currentUserId: string;
}

const QUICK_REACTIONS = [
  { emoji: "\uD83D\uDC4D", value: "thumbs_up" },
  { emoji: "\uD83D\uDC4E", value: "thumbs_down" },
];

export default function ReactionBar({
  reactions,
  jamId,
  spotifyTrackId,
  currentUserId,
}: ReactionBarProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [localReactions, setLocalReactions] = useState(reactions);

  // Group reactions by type
  const grouped = localReactions.reduce<
    Record<string, { count: number; users: string[]; hasCurrentUser: boolean }>
  >((acc, r) => {
    if (!acc[r.reaction]) {
      acc[r.reaction] = { count: 0, users: [], hasCurrentUser: false };
    }
    acc[r.reaction].count++;
    acc[r.reaction].users.push(r.displayName);
    if (r.userId === currentUserId) acc[r.reaction].hasCurrentUser = true;
    return acc;
  }, {});

  async function addReaction(reaction: string) {
    setShowPicker(false);

    // Optimistic update
    setLocalReactions((prev) => [
      ...prev.filter(
        (r) => !(r.userId === currentUserId)
      ),
      {
        userId: currentUserId,
        displayName: "You",
        avatarUrl: null,
        reaction,
        isAuto: false,
        createdAt: new Date().toISOString(),
      },
    ]);

    await fetch(`/api/jams/${jamId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spotifyTrackId, reaction }),
    });
  }

  async function removeReaction() {
    setLocalReactions((prev) =>
      prev.filter((r) => r.userId !== currentUserId)
    );

    await fetch(`/api/jams/${jamId}/reactions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spotifyTrackId }),
    });
  }

  const currentUserReaction = localReactions.find(
    (r) => r.userId === currentUserId
  );

  const reactionToEmoji = (value: string): string => {
    const quick = QUICK_REACTIONS.find((r) => r.value === value);
    if (quick) return quick.emoji;
    return value; // Custom emoji is stored directly
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {Object.entries(grouped).map(([reaction, data]) => (
        <button
          key={reaction}
          onClick={() =>
            data.hasCurrentUser ? removeReaction() : addReaction(reaction)
          }
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
            data.hasCurrentUser
              ? "border-spotify/50 bg-spotify/10"
              : "border-border hover:border-muted"
          }`}
          data-tooltip={data.users.join(", ")}
        >
          <span>{reactionToEmoji(reaction)}</span>
          <span className="text-muted">{data.count}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-border hover:border-muted transition-colors text-muted"
          data-tooltip="Add reaction"
        >
          +
        </button>
        {showPicker && (
          <div className="absolute bottom-full left-0 mb-1 bg-card border border-border rounded-lg p-2 flex gap-1 shadow-lg z-50">
            {QUICK_REACTIONS.map((r) => (
              <button
                key={r.value}
                onClick={() => addReaction(r.value)}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-card-hover text-lg"
              >
                {r.emoji}
              </button>
            ))}
            <button
              onClick={() => {
                const emoji = prompt("Enter an emoji:");
                if (emoji) addReaction(emoji);
              }}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-card-hover text-xs text-muted"
              data-tooltip="Custom emoji"
            >
              ...
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
