import { db } from '@/db';
import { playlists, playlistTracks } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { reorderPlaylistTracks } from '@/lib/spotify';
import { getVibeScores } from '@/lib/tunebat';
import { generateAndSaveVibeName } from '@/lib/vibe-name';
import type { SortMode } from '@/lib/utils';

/**
 * Sort a playlist's active tracks according to its configured sortMode,
 * then reorder on Spotify. Silently skips if < 2 tracks.
 */
export async function sortPlaylistTracks(playlistId: string): Promise<void> {
  const playlist = await db.query.playlists.findFirst({
    where: eq(playlists.id, playlistId),
  });
  if (!playlist) return;

  const tracks = await db.query.playlistTracks.findMany({
    where: and(eq(playlistTracks.playlistId, playlistId), isNull(playlistTracks.removedAt)),
  });

  if (tracks.length < 2) return;

  const sortMode = (playlist.sortMode ?? 'order_added') as SortMode;
  let sorted: typeof tracks;

  switch (sortMode) {
    case 'energy_desc':
    case 'energy_asc':
      sorted = await sortByEnergy(tracks, sortMode);
      break;
    case 'round_robin':
      sorted = sortRoundRobin(tracks);
      break;
    case 'order_added':
    default:
      sorted = sortByAddedAt(tracks);
      break;
  }

  const sortedUris = sorted.map((t) => t.spotifyTrackUri);
  await reorderPlaylistTracks(
    playlist.ownerId,
    playlist.circleId,
    playlist.spotifyPlaylistId,
    sortedUris
  );

  // Regenerate vibe name for energy-based sorts (they already fetch Tunebat data)
  if (sortMode === 'energy_desc' || sortMode === 'energy_asc') {
    const trackData = tracks.map((t) => ({
      spotifyTrackId: t.spotifyTrackId,
      trackName: t.trackName,
      artistName: t.artistName,
    }));
    // vibeScores were already fetched inside sortByEnergy — refetch for vibe name
    // This is a fire-and-forget side effect, acceptable to re-fetch
    getVibeScores(trackData)
      .then((scores) => generateAndSaveVibeName(playlistId, trackData, scores))
      .catch(() => {});
  }
}

/**
 * Sort by addedAt ascending (oldest first).
 */
function sortByAddedAt<T extends { addedAt: Date }>(tracks: T[]): T[] {
  return [...tracks].sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());
}

/**
 * Sort by Tunebat energy field. Tracks without scores go to the end.
 */
async function sortByEnergy<
  T extends { spotifyTrackId: string; trackName: string; artistName: string },
>(tracks: T[], direction: 'energy_desc' | 'energy_asc'): Promise<T[]> {
  const trackData = tracks.map((t) => ({
    spotifyTrackId: t.spotifyTrackId,
    trackName: t.trackName,
    artistName: t.artistName,
  }));

  const vibeScores = await getVibeScores(trackData);

  return [...tracks].sort((a, b) => {
    const energyA = vibeScores.get(a.spotifyTrackId)?.energy ?? -1;
    const energyB = vibeScores.get(b.spotifyTrackId)?.energy ?? -1;
    return direction === 'energy_desc' ? energyB - energyA : energyA - energyB;
  });
}

/**
 * Round-robin interleave tracks between contributors.
 *
 * Contributor order: sorted by their earliest addedAt among active tracks.
 * Within each contributor: tracks ordered oldest → newest.
 * Interleave like dealing cards: contributor1-track1, contributor2-track1,
 * contributor1-track2, contributor2-track2, ...
 * When a contributor runs out, remaining contributors continue filling slots.
 */
function sortRoundRobin<T extends { addedByUserId: string; addedAt: Date }>(tracks: T[]): T[] {
  // Group tracks by contributor
  const byContributor = new Map<string, T[]>();
  for (const track of tracks) {
    const userId = track.addedByUserId;
    if (!byContributor.has(userId)) {
      byContributor.set(userId, []);
    }
    byContributor.get(userId)!.push(track);
  }

  // Sort each contributor's tracks by addedAt ascending
  for (const userTracks of byContributor.values()) {
    userTracks.sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());
  }

  // Order contributors by their earliest addedAt
  const contributorOrder = [...byContributor.entries()]
    .map(([userId, userTracks]) => ({
      userId,
      earliestAddedAt: new Date(userTracks[0]!.addedAt).getTime(),
      tracks: userTracks,
    }))
    .sort((a, b) => a.earliestAddedAt - b.earliestAddedAt);

  // Interleave: deal cards round-robin
  const result: T[] = [];
  const maxTracks = Math.max(...contributorOrder.map((c) => c.tracks.length));

  for (let i = 0; i < maxTracks; i++) {
    for (const contributor of contributorOrder) {
      if (i < contributor.tracks.length) {
        result.push(contributor.tracks[i]!);
      }
    }
  }

  return result;
}
