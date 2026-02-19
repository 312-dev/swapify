'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { springs, STAGGER_DELAY } from '@/lib/motion';
import AlbumArt from '@/components/AlbumArt';
import { toast } from 'sonner';

interface OutcastTrack {
  spotifyTrackId: string;
  spotifyTrackUri: string;
  trackName: string;
  artistName: string;
  albumImageUrl: string | null;
  addedBy: { id: string; displayName: string; avatarUrl: string | null };
  addedAt: string;
  removedAt: string | null;
  reaction: string | null;
}

interface OutcastTracksViewProps {
  outcastTracks: OutcastTrack[];
}

export default function OutcastTracksView({ outcastTracks }: OutcastTracksViewProps) {
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});
  const [savingTrack, setSavingTrack] = useState<string | null>(null);
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

  const trackIds = useMemo(
    () => outcastTracks.map((t) => t.spotifyTrackId).join(','),
    [outcastTracks]
  );

  // Fetch saved status for outcast tracks
  useEffect(() => {
    if (!trackIds) return;
    let stale = false;
    const ids = trackIds.split(',');

    async function fetchSaved() {
      const result: Record<string, boolean> = {};
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        try {
          const res = await fetch(`/api/library?ids=${batch.join(',')}`, {
            cache: 'no-store',
          });
          if (res.ok) {
            const data = await res.json();
            Object.assign(result, data);
          }
        } catch {
          return;
        }
      }
      if (!stale) {
        setSavedStatus((prev) => ({ ...prev, ...result }));
      }
    }
    fetchSaved();
    return () => {
      stale = true;
    };
  }, [trackIds]);

  async function toggleSaved(spotifyTrackId: string) {
    const isSaved = savedStatus[spotifyTrackId];
    setSavingTrack(spotifyTrackId);
    try {
      const res = await fetch('/api/library', {
        method: isSaved ? 'DELETE' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [spotifyTrackId] }),
      });
      if (res.ok) {
        setSavedStatus((prev) => ({ ...prev, [spotifyTrackId]: !isSaved }));
      }
    } catch {
      // Silently fail
    } finally {
      setSavingTrack(null);
    }
  }

  if (outcastTracks.length === 0) {
    return (
      <div className="text-center py-12 px-5 text-text-tertiary">
        <div className="text-4xl mb-3">👻</div>
        <p className="text-base">No outcasts yet.</p>
        <p className="text-sm mt-1">Tracks you skip or dislike will appear here.</p>
      </div>
    );
  }

  return (
    <div className="px-5 mt-4 pb-28">
      <div className="space-y-1">
        <AnimatePresence mode="popLayout">
          {outcastTracks.map((track, index) => (
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
                  className="w-full h-full rounded-none grayscale opacity-60"
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
              <div className="flex items-center gap-2 shrink-0">
                {track.reaction === 'thumbs_down' && <span className="text-xs">👎</span>}
                <button
                  onClick={() => toggleSaved(track.spotifyTrackId)}
                  disabled={savingTrack === track.spotifyTrackId}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                    savingTrack === track.spotifyTrackId
                      ? 'opacity-50'
                      : savedStatus[track.spotifyTrackId]
                        ? 'bg-brand/20 text-brand hover:bg-brand/30'
                        : 'bg-white/5 text-text-tertiary hover:bg-white/10 hover:text-text-secondary'
                  }`}
                  data-tooltip={
                    savedStatus[track.spotifyTrackId] ? 'Remove from library' : 'Save to library'
                  }
                >
                  {savedStatus[track.spotifyTrackId] ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  )}
                </button>
                {track.removedAt && (
                  <span
                    className="text-sm text-text-tertiary"
                    data-tooltip={`Removed ${new Date(track.removedAt).toLocaleString()}`}
                  >
                    {new Date(track.removedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
