'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { springs } from '@/lib/motion';
import { useAlbumColors } from '@/hooks/useAlbumColors';
import TrackCard from '@/components/TrackCard';
import TrackSearch from '@/components/TrackSearch';
import SwipeableTrackCard from '@/components/SwipeableTrackCard';
import ShareSheet from '@/components/ShareSheet';
import EditDetailsModal from '@/components/EditDetailsModal';
import PlaylistTabs from '@/components/PlaylistTabs';
import LikedTracksView from '@/components/LikedTracksView';
import OutcastTracksView from '@/components/OutcastTracksView';
import { Crown } from 'lucide-react';
import { toast } from 'sonner';
import ReauthOverlay from '@/components/ReauthOverlay';

interface PlaylistDetailClientProps {
  playlistId: string;
  playlistName: string;
  playlistDescription: string | null;
  playlistImageUrl: string | null;
  isOwner: boolean;
  ownerId: string;
  currentUserId: string;
  spotifyPlaylistId: string;
  vibeName: string | null;
  circleInviteCode: string;
  circleName: string;
  circleId: string;
  spotifyClientId: string;
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
  activeListeners: Array<{
    id: string;
    displayName: string;
    avatarUrl: string | null;
    progressMs: number;
    durationMs: number;
    capturedAt: number;
  }>;
}

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
}

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

export default function PlaylistDetailClient({
  playlistId,
  playlistName,
  playlistDescription,
  playlistImageUrl,
  isOwner,
  ownerId,
  currentUserId,
  spotifyPlaylistId,
  vibeName,
  circleInviteCode,
  circleName,
  circleId,
  spotifyClientId,
}: PlaylistDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [needsReauth, setNeedsReauth] = useState(false);
  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [members, setMembers] = useState<
    Array<{ id: string; displayName: string; avatarUrl: string | null }>
  >([]);
  const [activeTab, setActiveTab] = useState<'inbox' | 'liked' | 'outcasts'>('inbox');
  const [likedTracks, setLikedTracks] = useState<LikedTrack[]>([]);
  const [outcastTracks, setOutcastTracks] = useState<OutcastTrack[]>([]);
  const [likedPlaylistId, setLikedPlaylistId] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showEditDetails, setShowEditDetails] = useState(false);
  const [currentName, setCurrentName] = useState(playlistName);
  const [currentDescription, setCurrentDescription] = useState(playlistDescription);
  const [currentImageUrl, setCurrentImageUrl] = useState(playlistImageUrl);
  const [currentVibeName, setCurrentVibeName] = useState(vibeName);
  const [syncing, setSyncing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const albumColors = useAlbumColors(currentImageUrl);

  const fetchTracks = useCallback(async () => {
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks`);
      if (res.ok) {
        const data = await res.json();
        setTracks(data.tracks);
        setMembers(data.members);
        setLikedTracks(data.likedTracks ?? []);
        setOutcastTracks(data.outcastTracks ?? []);
        setLikedPlaylistId(data.likedPlaylistId ?? null);
        if (data.vibeName !== undefined) setCurrentVibeName(data.vibeName);
      } else if (res.status === 401) {
        const data = await res.json();
        if (data.needsReauth) setNeedsReauth(true);
      }
    } catch {
      // Silently fail on refresh
    } finally {
      setInitialLoading(false);
    }
  }, [playlistId]);

  // Check Spotify follow status on mount
  useEffect(() => {
    fetch(`/api/playlists/${playlistId}/follow-status`)
      .then((res) => (res.ok ? res.json() : { isFollowing: true }))
      .then((data) => setIsFollowing(data.isFollowing))
      .catch(() => setIsFollowing(true)); // Fail open
  }, [playlistId]);

  async function handleFollow() {
    setFollowLoading(true);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/follow`, { method: 'POST' });
      if (!res.ok) throw new Error();
      setIsFollowing(true);
      toast.success('Playlist followed on Spotify!');
    } catch {
      toast.error('Failed to follow playlist');
    } finally {
      setFollowLoading(false);
    }
  }

  // Initial fetch + auto-refresh every 10s
  useEffect(() => {
    fetchTracks();
    const interval = setInterval(fetchTracks, 10000);
    return () => clearInterval(interval);
  }, [fetchTracks]);

  // Auto-open share sheet when arriving from playlist creation (host only)
  useEffect(() => {
    if (isOwner && searchParams.get('share') === '1') {
      setShowShare(true);
      // Clean the URL without triggering a navigation
      window.history.replaceState({}, '', `/playlist/${playlistId}`);
    }
  }, [searchParams, playlistId, isOwner]);

  async function syncFromSpotify() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks/sync`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.metadata) {
          if (data.metadata.name !== undefined) setCurrentName(data.metadata.name);
          if (data.metadata.description !== undefined)
            setCurrentDescription(data.metadata.description);
          if (data.metadata.imageUrl !== undefined) setCurrentImageUrl(data.metadata.imageUrl);
        }
        await fetchTracks();
      } else if (res.status === 401) {
        const data = await res.json();
        if (data.needsReauth) setNeedsReauth(true);
      }
    } catch {
      // Silently fail
    } finally {
      setSyncing(false);
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
      {needsReauth && <ReauthOverlay spotifyClientId={spotifyClientId} circleId={circleId} />}

      {/* Gradient header — dynamic album colors or fallback */}
      <div
        className={albumColors.isExtracted ? 'px-5 pt-8 pb-6' : 'gradient-bg-radial px-5 pt-8 pb-6'}
        style={
          albumColors.isExtracted
            ? {
                backgroundImage: albumColors.backgroundImage,
                backgroundColor: '#0a0a0a',
              }
            : undefined
        }
      >
        {/* Top bar: back + settings */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.back()}
            className="text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Go back"
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
          <Link
            href={`/playlist/${playlistId}/settings`}
            className="text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Settings"
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
          </Link>
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
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand/20 to-transparent">
                    <svg
                      className="w-14 h-14 text-brand/40"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                  </div>
                )}
              </div>
              <span className="text-3xl font-bold text-text-primary">{currentName}</span>
              {currentDescription && (
                <span className="text-base text-text-secondary mt-1 max-w-xs">
                  {currentDescription}
                </span>
              )}
              {currentVibeName && tracks.length > 3 && (
                <span className="text-sm text-brand italic mt-1.5">{currentVibeName}</span>
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
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand/20 to-transparent">
                    <svg
                      className="w-14 h-14 text-brand/40"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                  </div>
                )}
              </div>
              <h1 className="text-3xl font-bold text-text-primary">{currentName}</h1>
              {currentDescription && (
                <p className="text-base text-text-secondary mt-1 max-w-xs">{currentDescription}</p>
              )}
              {currentVibeName && tracks.length > 3 && (
                <p className="text-sm text-brand italic mt-1.5">{currentVibeName}</p>
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
              className="btn-pill-secondary btn-pill-sm gap-1.5 disabled:opacity-50"
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
            {isOwner && (
              <button onClick={() => setShowShare(true)} className="btn-pill-secondary btn-pill-sm">
                Invite
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <PlaylistTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        inboxCount={
          tracks.filter((t) => {
            if (t.addedBy.id === currentUserId) return false;
            const myProgress = t.progress.find((p) => p.id === currentUserId);
            return !myProgress?.hasListened;
          }).length
        }
        likedCount={likedTracks.length}
        outcastCount={outcastTracks.length}
      />

      {/* Follow gate banner */}
      {isFollowing === false && (
        <div className="mx-4 mt-4 glass rounded-2xl p-5 text-center">
          <svg
            className="w-8 h-8 mx-auto mb-2 text-accent-green"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          <p className="text-base font-semibold text-text-primary mb-1">
            Follow this Swaplist on Spotify
          </p>
          <p className="text-sm text-text-secondary mb-4">
            You need to follow this playlist in your Spotify library to add tracks and react.
          </p>
          <button
            onClick={handleFollow}
            disabled={followLoading}
            className="btn-pill text-sm px-6 py-2.5 bg-accent-green text-black hover:bg-accent-green/90 disabled:opacity-50"
          >
            {followLoading ? 'Following...' : 'Follow on Spotify'}
          </button>
        </div>
      )}

      {activeTab === 'inbox' && (
        <>
          {/* Drag & drop hint */}
          {isDragOver && isFollowing !== false && (
            <div className="mx-5 mt-4 border-2 border-dashed border-brand rounded-xl p-8 text-center bg-brand/5">
              <p className="text-brand font-medium">Drop a Spotify track link here</p>
            </div>
          )}

          {/* Track search */}
          {isFollowing !== false && (
            <div className="px-5 mt-4 mb-4">
              <TrackSearch playlistId={playlistId} onTrackAdded={fetchTracks} />
            </div>
          )}

          {/* Active tracks */}
          <div className="px-4 space-y-2">
            {initialLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="glass rounded-xl p-3 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg skeleton shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 skeleton w-3/5" />
                    <div className="h-3 skeleton w-2/5" />
                  </div>
                </div>
              ))
            ) : tracks.length === 0 ? (
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
                      disabled={track.addedBy.id === currentUserId || isFollowing === false}
                      currentReaction={
                        track.reactions.find((r) => r.userId === currentUserId)?.reaction ?? null
                      }
                    >
                      <TrackCard
                        track={track}
                        activeListeners={track.activeListeners}
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
        </>
      )}

      {activeTab === 'liked' && (
        <LikedTracksView
          playlistId={playlistId}
          likedTracks={likedTracks}
          likedPlaylistId={likedPlaylistId}
          onPlaylistCreated={(id) => setLikedPlaylistId(id)}
        />
      )}

      {activeTab === 'outcasts' && <OutcastTracksView outcastTracks={outcastTracks} />}

      {/* Share sheet (host only) */}
      {isOwner && (
        <ShareSheet
          isOpen={showShare}
          onClose={() => setShowShare(false)}
          circleInviteCode={circleInviteCode}
          circleName={circleName}
          circleId={circleId}
        />
      )}

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
