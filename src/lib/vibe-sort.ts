import { db } from '@/db';
import { playlists, playlistTracks } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { reorderPlaylistTracks } from '@/lib/spotify';
import { getVibeScores } from '@/lib/tunebat';
import { generateAndSaveVibeName } from '@/lib/vibe-name';

/**
 * Sort a playlist's active tracks by vibe (exciting → calm) on Spotify.
 * Also regenerates the playlist's vibe name label via Claude Haiku.
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

  const trackData = tracks.map((t) => ({
    spotifyTrackId: t.spotifyTrackId,
    trackName: t.trackName,
    artistName: t.artistName,
  }));

  const vibeScores = await getVibeScores(trackData);

  const sorted = [...tracks].sort((a, b) => {
    const scoreA = vibeScores.get(a.spotifyTrackId)?.score ?? -1;
    const scoreB = vibeScores.get(b.spotifyTrackId)?.score ?? -1;
    return scoreB - scoreA;
  });

  const sortedUris = sorted.map((t) => t.spotifyTrackUri);
  await reorderPlaylistTracks(
    playlist.ownerId,
    playlist.circleId,
    playlist.spotifyPlaylistId,
    sortedUris
  );

  // Regenerate vibe name from the already-fetched scores (fire-and-forget)
  generateAndSaveVibeName(playlistId, trackData, vibeScores).catch(() => {});
}
