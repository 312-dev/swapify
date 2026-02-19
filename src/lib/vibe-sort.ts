import { db } from '@/db';
import { playlists, playlistTracks } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { reorderPlaylistTracks } from '@/lib/spotify';
import { getVibeScores } from '@/lib/tunebat';

/**
 * Sort a playlist's active tracks by vibe (exciting → calm) on Spotify.
 * Uses the playlist owner's token. Silently skips if < 2 tracks.
 */
export async function vibeSort(playlistId: string): Promise<void> {
  const playlist = await db.query.playlists.findFirst({
    where: eq(playlists.id, playlistId),
  });
  if (!playlist) return;

  const tracks = await db.query.playlistTracks.findMany({
    where: and(eq(playlistTracks.playlistId, playlistId), isNull(playlistTracks.removedAt)),
  });

  if (tracks.length < 2) return;

  const vibeScores = await getVibeScores(
    tracks.map((t) => ({
      spotifyTrackId: t.spotifyTrackId,
      trackName: t.trackName,
      artistName: t.artistName,
    }))
  );

  const sorted = [...tracks].sort((a, b) => {
    const scoreA = vibeScores.get(a.spotifyTrackId)?.score ?? -1;
    const scoreB = vibeScores.get(b.spotifyTrackId)?.score ?? -1;
    return scoreB - scoreA;
  });

  const sortedUris = sorted.map((t) => t.spotifyTrackUri);
  await reorderPlaylistTracks(playlist.ownerId, playlist.spotifyPlaylistId, sortedUris);
}
