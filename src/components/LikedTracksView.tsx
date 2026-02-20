'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { springs, STAGGER_DELAY } from '@/lib/motion';
import AlbumArt from '@/components/AlbumArt';
import { Repeat2 } from 'lucide-react';
import { toast } from 'sonner';

interface LikedTrack {
  spotifyTrackId: string;
  spotifyTrackUri: string;
  trackName: string;
  artistName: string;
  albumImageUrl: string | null;
  addedBy: { id: string; displayName: string; avatarUrl: string | null };
  addedAt: string;
  removedAt: string | null;
  isActive: boolean;
  memberListenCounts: Array<{
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    listenCount: number;
  }>;
}

interface LikedTracksViewProps {
  playlistId: string;
  likedTracks: LikedTrack[];
  likedPlaylistId: string | null;
  onPlaylistCreated: (spotifyPlaylistId: string) => void;
}

export default function LikedTracksView({
  playlistId,
  likedTracks,
  likedPlaylistId,
  onPlaylistCreated,
}: LikedTracksViewProps) {
  const [creating, setCreating] = useState(false);
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);

  async function handlePlay(spotifyTrackUri: string) {
    setPlayingTrack(spotifyTrackUri);
    try {
      const res = await fetch('/api/spotify/play', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackUri: spotifyTrackUri }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Playback failed');
      }
    } catch {
      toast.error('Could not reach server');
    } finally {
      setPlayingTrack(null);
    }
  }

  async function handleOpenInSpotify() {
    if (likedPlaylistId) {
      window.open(`https://open.spotify.com/playlist/${likedPlaylistId}`, '_blank');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/liked-playlist`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to create playlist');
        return;
      }
      const data = await res.json();
      onPlaylistCreated(data.spotifyPlaylistId);
      window.open(data.spotifyPlaylistUrl, '_blank');
      toast.success('Liked playlist created on Spotify!');
    } catch {
      toast.error('Failed to create liked playlist');
    } finally {
      setCreating(false);
    }
  }

  if (likedTracks.length === 0) {
    return (
      <div className="text-center py-12 px-5 text-text-tertiary">
        <div className="text-4xl mb-3">👍</div>
        <p className="text-base">No liked tracks yet.</p>
        <p className="text-sm mt-1">Swipe right on tracks you enjoy!</p>
      </div>
    );
  }

  return (
    <div className="px-5 mt-4 pb-28">
      {/* Open in Spotify button */}
      <button
        onClick={handleOpenInSpotify}
        disabled={creating}
        className="btn-pill btn-pill-primary w-full mb-4 gap-2 disabled:opacity-50"
      >
        {creating ? (
          'Creating playlist...'
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            {likedPlaylistId ? 'Open in Spotify' : 'Save to Spotify'}
          </>
        )}
      </button>

      {likedPlaylistId && (
        <p className="text-xs text-text-tertiary text-center mb-4">
          Your liked playlist syncs automatically
        </p>
      )}

      {/* Track list */}
      <div className="space-y-1">
        <AnimatePresence mode="popLayout">
          {likedTracks.map((track, index) => (
            <motion.div
              key={track.spotifyTrackId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ ...springs.gentle, delay: Math.min(index, 10) * STAGGER_DELAY }}
              className="flex items-center gap-3 p-3 rounded-xl"
            >
              <button
                onClick={() => handlePlay(track.spotifyTrackUri)}
                disabled={playingTrack === track.spotifyTrackUri}
                className="group relative w-10 h-10 rounded-lg shrink-0 overflow-hidden cursor-pointer border-0 p-0 bg-transparent"
                data-tooltip="Play on Spotify"
              >
                <AlbumArt
                  src={track.albumImageUrl}
                  alt={track.trackName}
                  className={`w-full h-full rounded-none ${!track.isActive ? 'grayscale opacity-60' : ''}`}
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {playingTrack === track.spotifyTrackUri ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </div>
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-base truncate text-text-primary">{track.trackName}</p>
                <p className="text-sm text-text-secondary truncate">
                  {track.artistName}
                  <span className="text-text-tertiary"> · {track.addedBy.displayName}</span>
                </p>
              </div>
              {track.memberListenCounts?.some((m) => m.listenCount > 0) && (
                <div
                  className="flex items-center gap-0.5 text-text-tertiary shrink-0"
                  data-tooltip={track.memberListenCounts
                    .filter((m) => m.listenCount > 0)
                    .map((m) => `${m.displayName}: ${m.listenCount}x`)
                    .join(', ')}
                >
                  <Repeat2 className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">
                    {track.memberListenCounts.reduce((sum, m) => sum + m.listenCount, 0)}
                  </span>
                </div>
              )}
              {!track.isActive && (
                <span className="text-xs text-text-tertiary shrink-0">Played</span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
