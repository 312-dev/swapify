"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import TrackCard from "@/components/TrackCard";
import TrackSearch from "@/components/TrackSearch";
import SwipeableTrackCard from "@/components/SwipeableTrackCard";
import AlbumArt from "@/components/AlbumArt";

interface JamDetailClientProps {
  jamId: string;
  jamName: string;
  jamDescription: string | null;
  jamImageUrl: string | null;
  inviteCode: string;
  isOwner: boolean;
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

export default function JamDetailClient({
  jamId,
  jamName,
  jamDescription,
  jamImageUrl,
  inviteCode,
  isOwner,
  currentUserId,
  spotifyPlaylistId,
}: JamDetailClientProps) {
  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [previousTracks, setPreviousTracks] = useState<PreviousTrack[]>([]);
  const [members, setMembers] = useState<
    Array<{ id: string; displayName: string; avatarUrl: string | null }>
  >([]);
  const [showPrevious, setShowPrevious] = useState(false);
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sorting, setSorting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const fetchTracks = useCallback(async () => {
    try {
      const res = await fetch(`/api/jams/${jamId}/tracks`);
      if (res.ok) {
        const data = await res.json();
        setTracks(data.tracks);
        setPreviousTracks(data.previousTracks);
        setMembers(data.members);
      }
    } catch {
      // Silently fail on refresh
    }
  }, [jamId]);

  // Initial fetch + auto-refresh every 10s
  useEffect(() => {
    fetchTracks();
    const interval = setInterval(fetchTracks, 10000);
    return () => clearInterval(interval);
  }, [fetchTracks]);

  async function syncFromSpotify() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/jams/${jamId}/tracks/sync`, {
        method: "POST",
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
      const res = await fetch(`/api/jams/${jamId}/tracks/sort-by-vibe`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchTracks();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to sort tracks");
      }
    } catch {
      alert("Failed to sort tracks by vibe");
    } finally {
      setSorting(false);
    }
  }

  function copyInviteLink() {
    const url = `${window.location.origin}/jam/join?code=${inviteCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleReaction(spotifyTrackId: string, reaction: string) {
    try {
      await fetch(`/api/jams/${jamId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    const text =
      e.dataTransfer.getData("text/plain") ||
      e.dataTransfer.getData("text/uri-list");

    if (!text) return;

    const match = text.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/);
    if (!match) {
      alert("Drop a Spotify track link to add it.");
      return;
    }

    const trackId = match[1];

    // We need to look up the track details from Spotify
    // Search for the track by ID
    try {
      const searchRes = await fetch(
        `/api/spotify/search?q=track:${trackId}`
      );
      if (!searchRes.ok) throw new Error("Search failed");
      const searchData = await searchRes.json();

      const track = searchData.tracks?.find(
        (t: { id: string }) => t.id === trackId
      );
      if (!track) {
        alert("Could not find that track on Spotify.");
        return;
      }

      const res = await fetch(`/api/jams/${jamId}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotifyTrackUri: track.uri,
          spotifyTrackId: track.id,
          trackName: track.name,
          artistName: track.artists.map((a: { name: string }) => a.name).join(", "),
          albumName: track.album.name,
          albumImageUrl: track.album.images[0]?.url || null,
          durationMs: track.duration_ms,
        }),
      });

      if (res.ok) {
        fetchTracks();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to add track");
      }
    } catch {
      alert("Failed to add the dropped track.");
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
        {/* Back button */}
        <button
          onClick={() => window.history.back()}
          className="mb-4 text-text-secondary hover:text-text-primary transition-colors"
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

        {/* Cover + Info centered layout */}
        <div className="flex flex-col items-center text-center">
          {/* Large cover image */}
          <div className="w-44 h-44 rounded-2xl overflow-hidden mb-5" style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
            {jamImageUrl ? (
              <img
                src={jamImageUrl}
                alt={jamName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-spotify/20 to-transparent">
                <svg
                  className="w-14 h-14 text-spotify/40"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
            )}
          </div>

          {/* Title + description */}
          <h1 className="text-2xl font-bold text-text-primary">{jamName}</h1>
          {jamDescription && (
            <p className="text-sm text-text-secondary mt-1 max-w-xs">
              {jamDescription}
            </p>
          )}

          {/* Member avatars */}
          <div className="flex items-center gap-3 mt-3">
            <div className="avatar-stack flex">
              {members.slice(0, 5).map((m) =>
                m.avatarUrl ? (
                  <img
                    key={m.id}
                    src={m.avatarUrl}
                    alt={m.displayName}
                    className="w-7 h-7 rounded-full"
                    data-tooltip={m.displayName}
                  />
                ) : (
                  <div
                    key={m.id}
                    className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[11px] text-text-secondary"
                    data-tooltip={m.displayName}
                  >
                    {m.displayName[0]}
                  </div>
                )
              )}
            </div>
            <span className="text-xs text-text-tertiary">
              {members.length} member{members.length !== 1 ? "s" : ""} &middot;{" "}
              {tracks.length} track{tracks.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Action pills */}
          <div className="flex items-center gap-2 mt-5 flex-wrap justify-center">
            <button
              onClick={syncFromSpotify}
              disabled={syncing}
              className="btn-pill-secondary text-xs! py-2! px-4! gap-1.5! disabled:opacity-50"
            >
              <svg
                className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`}
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
                className="btn-pill-secondary text-xs! py-2! px-4! disabled:opacity-50"
              >
                {sorting ? "Sorting..." : "Vibe sort"}
              </button>
            )}
            <button
              onClick={copyInviteLink}
              className="btn-pill-secondary text-xs! py-2! px-4!"
            >
              {copied ? "Copied!" : "Share"}
            </button>
            {isOwner && (
              <a
                href={`/jam/${jamId}/settings`}
                className="btn-pill-secondary text-xs! py-2! px-4!"
              >
                Settings
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Drag & drop hint */}
      {isDragOver && (
        <div className="mx-5 mt-4 border-2 border-dashed border-spotify rounded-xl p-8 text-center bg-spotify/5">
          <p className="text-spotify font-medium">
            Drop a Spotify track link here
          </p>
        </div>
      )}

      {/* Track search */}
      <div className="px-5 mt-4 mb-4">
        <TrackSearch jamId={jamId} onTrackAdded={fetchTracks} />
      </div>

      {/* Active tracks */}
      <div className="px-4 space-y-2">
        {tracks.length === 0 ? (
          <div className="text-center py-12 text-text-tertiary">
            <p className="text-sm">No tracks yet. Search above to add one.</p>
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
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <SwipeableTrackCard
                  onSwipeRight={() =>
                    handleReaction(track.spotifyTrackId, "thumbs_up")
                  }
                  onSwipeLeft={() =>
                    handleReaction(track.spotifyTrackId, "thumbs_down")
                  }
                  disabled={track.addedBy.id === currentUserId}
                >
                  <TrackCard
                    track={track}
                    jamId={jamId}
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
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors mb-3"
          >
            <svg
              className={`w-4 h-4 transition-transform ${
                showPrevious ? "rotate-90" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            Previously Played ({previousTracks.length})
          </button>

          <AnimatePresence>
            {showPrevious && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden"
              >
                {previousTracks.map((track) => (
                  <div
                    key={track.id}
                    className="glass rounded-xl p-3 flex items-center gap-3"
                  >
                    <AlbumArt src={track.albumImageUrl} alt={track.trackName} className="w-10 h-10 rounded-lg grayscale" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate text-text-primary">
                        {track.trackName}
                      </p>
                      <p className="text-xs text-text-secondary truncate">
                        {track.artistName} &middot; Added by{" "}
                        {track.addedBy.displayName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {track.archivedAt && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-spotify/15 text-spotify">
                          Kept
                        </span>
                      )}
                      <span
                        className="text-xs text-text-tertiary"
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
    </main>
  );
}
