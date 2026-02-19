'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { springs } from '@/lib/motion';
import TrackCard from '@/components/TrackCard';
import TrackSearch from '@/components/TrackSearch';
import SwipeableTrackCard from '@/components/SwipeableTrackCard';
import AlbumArt from '@/components/AlbumArt';
import ShareSheet from '@/components/ShareSheet';
import EditDetailsModal from '@/components/EditDetailsModal';
import { Crown } from 'lucide-react';
import { toast } from 'sonner';

interface PlaylistDetailClientProps {
  playlistId: string;
  playlistName: string;
  playlistDescription: string | null;
  playlistImageUrl: string | null;
  inviteCode: string;
  isOwner: boolean;
  ownerId: string;
  currentUserId: string;
  spotifyPlaylistId: string;
}

interface TrackData {
  id: string;
  spotifyTrackId: string;
  spotifyTrackUri: string;
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
}

interface PreviousTrack {
  id: string;
  spotifyTrackId: string;
  trackName: string;
  artistName: string;
  albumImageUrl: string | null;
  addedBy: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  addedAt: string;
  removedAt: string;
  archivedAt: string | null;
}

export default function PlaylistDetailClient({
  playlistId,
  playlistName,
  playlistDescription,
  playlistImageUrl,
  inviteCode,
  isOwner,
  ownerId,
  currentUserId,
  spotifyPlaylistId,
}: PlaylistDetailClientProps) {
  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [previousTracks, setPreviousTracks] = useState<PreviousTrack[]>([]);
  const [members, setMembers] = useState<
    Array<{ id: string; displayName: string; avatarUrl: string | null }>
  >([]);
  const [showPrevious, setShowPrevious] = useState(false);
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});
  const [savingTrack, setSavingTrack] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showEditDetails, setShowEditDetails] = useState(false);
  const [currentName, setCurrentName] = useState(playlistName);
  const [currentDescription, setCurrentDescription] = useState(playlistDescription);
  const [currentImageUrl, setCurrentImageUrl] = useState(playlistImageUrl);
  const [syncing, setSyncing] = useState(false);
  const [sorting, setSorting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const fetchTracks = useCallback(async () => {
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks`);
      if (res.ok) {
        const data = await res.json();
        setTracks(data.tracks);
        setPreviousTracks(data.previousTracks);
        setMembers(data.members);
      }
    } catch {
      // Silently fail on refresh
    }
  }, [playlistId]);

  // Initial fetch + auto-refresh every 10s
  useEffect(() => {
    fetchTracks();
    const interval = setInterval(fetchTracks, 10000);
    return () => clearInterval(interval);
  }, [fetchTracks]);

  async function syncFromSpotify() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks/sync`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchTracks();
      }
    } catch {
      // Silently fail
    } finally {
      setSyncing(false);
    }
  }

  async function sortByVibe() {
    setSorting(true);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks/sort-by-vibe`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchTracks();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to sort tracks');
      }
    } catch {
      toast.error('Failed to sort tracks by vibe');
    } finally {
      setSorting(false);
    }
  }

  // Stable key derived from previous track IDs — only re-fetch when the actual
  // set of tracks changes, not on every polling reference change.
  const previousTrackIds = useMemo(
    () => previousTracks.map((t) => t.spotifyTrackId).join(','),
    [previousTracks]
  );

  // Fetch saved status when previously played section is expanded
  useEffect(() => {
    if (!showPrevious || !previousTrackIds) return;
    let stale = false;
    const ids = previousTrackIds.split(',');
    // Batch in groups of 50 (Spotify limit)
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
          // On error, don't overwrite existing state
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
  }, [showPrevious, previousTrackIds]);

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

  async function handleReaction(spotifyTrackId: string, reaction: string) {
    try {
      await fetch(`/api/playlists/${playlistId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotifyTrackId, reaction }),
      });
      fetchTracks();
    } catch {
      // Silently fail
    }
  }

  // Drag and drop from Spotify
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);

    // Spotify URLs look like: https://open.spotify.com/track/TRACKID
    const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');

    if (!text) return;

    const match = text.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/);
    if (!match) {
      toast.info('Drop a Spotify track link to add it.');
      return;
    }

    const trackId = match[1];

    // We need to look up the track details from Spotify
    // Search for the track by ID
    try {
      const searchRes = await fetch(`/api/spotify/search?q=track:${trackId}`);
      if (!searchRes.ok) throw new Error('Search failed');
      const searchData = await searchRes.json();

      const track = searchData.tracks?.find((t: { id: string }) => t.id === trackId);
      if (!track) {
        toast.error('Could not find that track on Spotify.');
        return;
      }

      const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spotifyTrackUri: track.uri,
          spotifyTrackId: track.id,
          trackName: track.name,
          artistName: track.artists.map((a: { name: string }) => a.name).join(', '),
          albumName: track.album.name,
          albumImageUrl: track.album.images[0]?.url || null,
          durationMs: track.duration_ms,
        }),
      });

      if (res.ok) {
        fetchTracks();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to add track');
      }
    } catch {
      toast.error('Failed to add the dropped track.');
    }
  }

  return (
    <main
      className="min-h-screen"
      ref={dropRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Gradient header */}
      <div className="gradient-bg-radial px-5 pt-8 pb-6">
        {/* Top bar: back + settings */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => window.history.back()}
            className="text-text-secondary hover:text-text-primary transition-colors"
            data-tooltip="Go back"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <a
            href={`/playlist/${playlistId}/settings`}
            className="text-text-secondary hover:text-text-primary transition-colors"
            data-tooltip="Settings"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </a>
        </div>

        {/* Cover + Info centered layout */}
        <div className="flex flex-col items-center text-center">
          {/* Cover + title + description (clickable to edit for owner) */}
          {isOwner ? (
            <button
              type="button"
              onClick={() => setShowEditDetails(true)}
              className="flex flex-col items-center text-center cursor-pointer bg-transparent border-none p-0"
            >
              <div
                className="w-44 h-44 rounded-2xl overflow-hidden mb-5"
                style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
              >
                {currentImageUrl ? (
                  <img
                    src={currentImageUrl}
                    alt={currentName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-spotify/20 to-transparent">
                    <svg className="w-14 h-14 text-spotify/40" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                  </div>
                )}
              </div>
              <span className="text-3xl font-bold text-text-primary">{currentName}</span>
              {currentDescription && (
                <span className="text-base text-text-secondary mt-1 max-w-xs">{currentDescription}</span>
              )}
            </button>
          ) : (
            <>
              <div
                className="w-44 h-44 rounded-2xl overflow-hidden mb-5"
                style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
              >
                {currentImageUrl ? (
                  <img
                    src={currentImageUrl}
                    alt={currentName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-spotify/20 to-transparent">
                    <svg className="w-14 h-14 text-spotify/40" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                  </div>
                )}
              </div>
              <h1 className="text-3xl font-bold text-text-primary">{currentName}</h1>
              {currentDescription && (
                <p className="text-base text-text-secondary mt-1 max-w-xs">{currentDescription}</p>
              )}
            </>
          )}

          {/* Member avatars */}
          <div className="flex items-center gap-3 mt-3">
            <div className="avatar-stack flex">
              {members.slice(0, 5).map((m) => (
                <div
                  key={m.id}
                  className="relative"
                  data-tooltip={m.id === ownerId ? `${m.displayName} (owner)` : m.displayName}
                >
                  {m.avatarUrl ? (
                    <img src={m.avatarUrl} alt={m.displayName} className="w-7 h-7 rounded-full" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs text-text-secondary">
                      {m.displayName[0]}
                    </div>
                  )}
                  {m.id === ownerId && (
                    <Crown className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 text-yellow-400 fill-yellow-400 drop-shadow" />
                  )}
                </div>
              ))}
            </div>
            <span className="text-sm text-text-tertiary">
              {members.length} member{members.length !== 1 ? 's' : ''} &middot; {tracks.length}{' '}
              track{tracks.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Action pills */}
          <div className="flex items-center gap-2 mt-5 flex-wrap justify-center">
            <button
              onClick={syncFromSpotify}
              disabled={syncing}
              className="btn-pill-secondary text-sm! py-2! px-4! gap-1.5! disabled:opacity-50"
            >
              <svg
                className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Sync
            </button>
            {isOwner && tracks.length >= 2 && (
              <button
                onClick={sortByVibe}
                disabled={sorting}
                className="btn-pill-secondary text-sm! py-2! px-4! disabled:opacity-50"
              >
                {sorting ? 'Sorting...' : 'Vibe sort'}
              </button>
            )}
            <button
              onClick={() => setShowShare(true)}
              className="btn-pill-secondary text-sm! py-2! px-4!"
            >
              Share
            </button>
          </div>
        </div>
      </div>

      {/* Drag & drop hint */}
      {isDragOver && (
        <div className="mx-5 mt-4 border-2 border-dashed border-spotify rounded-xl p-8 text-center bg-spotify/5">
          <p className="text-spotify font-medium">Drop a Spotify track link here</p>
        </div>
      )}

      {/* Track search */}
      <div className="px-5 mt-4 mb-4">
        <TrackSearch playlistId={playlistId} onTrackAdded={fetchTracks} />
      </div>

      {/* Active tracks */}
      <div className="px-4 space-y-2">
        {tracks.length === 0 ? (
          <div className="text-center py-12 text-text-tertiary">
            <p className="text-base">No tracks yet. Search above to add one.</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {tracks.map((track) => (
              <motion.div
                key={track.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={springs.gentle}
              >
                <SwipeableTrackCard
                  onSwipeRight={() => handleReaction(track.spotifyTrackId, 'thumbs_up')}
                  onSwipeLeft={() => handleReaction(track.spotifyTrackId, 'thumbs_down')}
                  onReaction={(reaction) => handleReaction(track.spotifyTrackId, reaction)}
                  disabled={track.addedBy.id === currentUserId}
                  currentReaction={
                    track.reactions.find((r) => r.userId === currentUserId)?.reaction ?? null
                  }
                >
                  <TrackCard
                    track={track}
                    playlistId={playlistId}
                    currentUserId={currentUserId}
                    spotifyTrackUri={track.spotifyTrackUri}
                    spotifyPlaylistUri={`spotify:playlist:${spotifyPlaylistId}`}
                  />
                </SwipeableTrackCard>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Previously played */}
      {previousTracks.length > 0 && (
        <div className="px-5 mt-8 pb-8">
          <button
            onClick={() => setShowPrevious(!showPrevious)}
            className="flex items-center gap-2 text-base text-text-secondary hover:text-text-primary transition-colors mb-3"
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${
                showPrevious ? 'rotate-90' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Previously Played ({previousTracks.length})
          </button>

          <AnimatePresence>
            {showPrevious && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden"
              >
                {previousTracks.map((track) => (
                  <div key={track.id} className="glass rounded-xl p-3 flex items-center gap-3">
                    <AlbumArt
                      src={track.albumImageUrl}
                      alt={track.trackName}
                      className="w-10 h-10 rounded-lg grayscale"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-base truncate text-text-primary">{track.trackName}</p>
                      <p className="text-sm text-text-secondary truncate">
                        {track.artistName} &middot; Added by {track.addedBy.displayName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {track.archivedAt && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-spotify/15 text-spotify">
                          Kept
                        </span>
                      )}
                      <button
                        onClick={() => toggleSaved(track.spotifyTrackId)}
                        disabled={savingTrack === track.spotifyTrackId}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          savingTrack === track.spotifyTrackId
                            ? 'opacity-50'
                            : savedStatus[track.spotifyTrackId]
                              ? 'bg-spotify/20 text-spotify hover:bg-spotify/30'
                              : 'bg-white/5 text-text-tertiary hover:bg-white/10 hover:text-text-secondary'
                        }`}
                        data-tooltip={
                          savedStatus[track.spotifyTrackId]
                            ? 'Remove from library'
                            : 'Save to library'
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
                      <span
                        className="text-sm text-text-tertiary"
                        data-tooltip={`Removed ${new Date(track.removedAt).toLocaleString()}`}
                      >
                        {new Date(track.removedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {/* Share sheet */}
      <ShareSheet
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        inviteCode={inviteCode}
        playlistId={playlistId}
        playlistName={currentName}
      />

      {/* Edit details modal */}
      {isOwner && (
        <EditDetailsModal
          open={showEditDetails}
          onOpenChange={setShowEditDetails}
          playlistId={playlistId}
          name={currentName}
          description={currentDescription}
          imageUrl={currentImageUrl}
          onSaved={(data) => {
            setCurrentName(data.name);
            setCurrentDescription(data.description);
            setCurrentImageUrl(data.imageUrl);
          }}
        />
      )}
    </main>
  );
}
