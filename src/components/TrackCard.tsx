'use client';

import { useState } from 'react';
import { MessageCircleHeart } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import AlbumArt from '@/components/AlbumArt';
import NowPlayingIndicator, { type ActiveListener } from '@/components/NowPlayingIndicator';

interface TrackCardProps {
  track: {
    id: string;
    spotifyTrackId: string;
    trackName: string;
    artistName: string;
    albumName: string | null;
    albumImageUrl: string | null;
    durationMs: number | null;
    addedBy: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
    };
    addedAt: string;
    progress: Array<{
      id: string;
      displayName: string;
      avatarUrl: string | null;
      hasListened: boolean;
      listenedAt: string | null;
    }>;
    listenedCount: number;
    totalRequired: number;
    reactions: Array<{
      userId: string;
      displayName: string;
      avatarUrl: string | null;
      reaction: string;
      isAuto: boolean;
      createdAt: string;
    }>;
  };
  activeListeners?: ActiveListener[];
  playlistId: string;
  currentUserId: string;
  spotifyTrackUri: string;
  spotifyPlaylistUri: string;
}

export default function TrackCard({
  track,
  activeListeners = [],
  currentUserId,
  spotifyTrackUri,
  spotifyPlaylistUri,
}: TrackCardProps) {
  const isComplete = track.listenedCount >= track.totalRequired && track.totalRequired > 0;
  const [playState, setPlayState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [playError, setPlayError] = useState<string | null>(null);

  // Track is pending the current user's reaction if they didn't add it and haven't reacted yet
  const isOwnTrack = track.addedBy.id === currentUserId;
  const hasReacted = track.reactions.some((r) => r.userId === currentUserId);
  const isPendingReaction = !isOwnTrack && !hasReacted && !isComplete;

  async function handlePlay() {
    setPlayState('loading');
    setPlayError(null);
    try {
      const res = await fetch('/api/spotify/play', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackUri: spotifyTrackUri,
          contextUri: spotifyPlaylistUri,
        }),
      });
      if (res.ok) {
        setPlayState('idle');
        globalThis.open(spotifyPlaylistUri, '_self');
      } else {
        const data = await res.json();
        setPlayError(data.error || 'Playback failed');
        setPlayState('error');
        setTimeout(() => {
          setPlayState('idle');
          setPlayError(null);
        }, 3000);
      }
    } catch {
      setPlayError('Could not reach server');
      setPlayState('error');
      setTimeout(() => {
        setPlayState('idle');
        setPlayError(null);
      }, 3000);
    }
  }

  const percentage =
    track.totalRequired > 0 ? (track.listenedCount / track.totalRequired) * 100 : 0;

  // Reaction summary - group reactions for inline display
  const reactionSummary = track.reactions.reduce<Record<string, number>>((acc, r) => {
    const emoji =
      r.reaction === 'thumbs_up'
        ? '\u{1F44D}'
        : r.reaction === 'thumbs_down'
          ? '\u{1F44E}'
          : r.reaction;
    acc[emoji] = (acc[emoji] || 0) + 1;
    return acc;
  }, {});

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${isComplete ? 'opacity-50' : ''} hover:bg-white/[0.03]`}
    >
      {/* Album art with play */}
      <button
        onClick={handlePlay}
        disabled={playState === 'loading'}
        className="group relative w-12 h-12 rounded-lg shrink-0 overflow-hidden cursor-pointer border-0 p-0 bg-transparent"
        data-tooltip="Play on Spotify"
        data-play-button
      >
        <AlbumArt
          src={track.albumImageUrl}
          alt={track.albumName || track.trackName}
          className="w-full h-full rounded-none"
        />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {playState === 'loading' ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </div>
      </button>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-base font-semibold truncate text-text-primary">{track.trackName}</p>
          {/* Inline reaction summary */}
          {Object.keys(reactionSummary).length > 0 && (
            <div className="flex items-center gap-0.5 text-xs shrink-0">
              {Object.entries(reactionSummary)
                .slice(0, 2)
                .map(([emoji, count]) => (
                  <span key={emoji} className="flex items-center">
                    <span>{emoji}</span>
                    {count > 1 && <span className="text-text-tertiary ml-0.5">{count}</span>}
                  </span>
                ))}
            </div>
          )}
          {/* Pending reaction indicator */}
          {isPendingReaction && (
            <MessageCircleHeart
              className="w-4 h-4 shrink-0 text-brand pending-reaction-pulse"
              data-tooltip="Double-tap to react"
            />
          )}
        </div>
        <p className="text-sm text-text-secondary truncate">
          {track.artistName}
          <span className="text-text-tertiary">
            {' '}
            &middot; {formatRelativeTime(new Date(track.addedAt))}
          </span>
        </p>
        {playError && <p className="text-sm text-danger mt-0.5">{playError}</p>}
        {activeListeners.length > 0 && (
          <div className="mt-0.5">
            <NowPlayingIndicator listeners={activeListeners} />
          </div>
        )}
      </div>

      {/* Right side: avatar + progress ring */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Added by avatar */}
        <div data-tooltip={track.addedBy.displayName}>
          {track.addedBy.avatarUrl ? (
            <img
              src={track.addedBy.avatarUrl}
              alt={track.addedBy.displayName}
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-text-secondary">
              {track.addedBy.displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Compact progress ring (SVG) */}
        <div className="relative w-8 h-8 shrink-0">
          <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
            <circle
              cx="16"
              cy="16"
              r="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-white/10"
            />
            <circle
              cx="16"
              cy="16"
              r="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeDasharray={`${2 * Math.PI * 13}`}
              strokeDashoffset={`${2 * Math.PI * 13 * (1 - percentage / 100)}`}
              strokeLinecap="round"
              className={isComplete ? 'text-brand' : 'text-brand/60'}
              style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
            />
          </svg>
          <span
            className={`absolute inset-0 flex items-center justify-center text-[9px] font-semibold ${isComplete ? 'text-brand' : 'text-text-tertiary'}`}
          >
            {isComplete ? '\u2713' : `${track.listenedCount}/${track.totalRequired}`}
          </span>
        </div>
      </div>
    </div>
  );
}
