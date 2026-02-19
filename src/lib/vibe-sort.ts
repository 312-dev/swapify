import { db } from "@/db";
import { jams, jamTracks } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { reorderPlaylistTracks } from "@/lib/spotify";
import { getVibeScores } from "@/lib/tunebat";

/**
 * Sort a jam's active tracks by vibe (exciting → calm) on Spotify.
 * Uses the jam owner's token. Silently skips if < 2 tracks.
 */
export async function vibeSort(jamId: string): Promise<void> {
  const jam = await db.query.jams.findFirst({
    where: eq(jams.id, jamId),
  });
  if (!jam) return;

  const tracks = await db.query.jamTracks.findMany({
    where: and(eq(jamTracks.jamId, jamId), isNull(jamTracks.removedAt)),
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
  await reorderPlaylistTracks(jam.ownerId, jam.spotifyPlaylistId, sortedUris);
}
