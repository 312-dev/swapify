import { NextResponse } from 'next/server';
import { requireAuth, getSession } from '@/lib/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { getUserPlaylists, TokenInvalidError } from '@/lib/spotify';
import { db } from '@/db';
import { playlists } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const user = await requireAuth();

  const session = await getSession();
  const circleId = session.activeCircleId;
  if (!circleId) {
    return NextResponse.json({ error: 'No active circle selected' }, { status: 400 });
  }

  const limited = checkRateLimit(`api:${user.id}`, RATE_LIMITS.api);
  if (limited) return limited;

  try {
    const spotifyPlaylists = await getUserPlaylists(user.id, circleId);

    // Get already-imported Spotify playlist IDs to mark them
    const existingSwaplists = await db.query.playlists.findMany({
      where: eq(playlists.circleId, circleId),
      columns: { spotifyPlaylistId: true },
    });
    const importedIds = new Set(existingSwaplists.map((p) => p.spotifyPlaylistId));

    return NextResponse.json({
      playlists: spotifyPlaylists.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        imageUrl: p.images?.[0]?.url || null,
        trackCount: p.items?.total ?? 0,
        collaborative: p.collaborative,
        isPublic: p.public,
        ownerId: p.owner.id,
        ownerName: p.owner.display_name,
        alreadyImported: importedIds.has(p.id),
      })),
    });
  } catch (err) {
    if (err instanceof TokenInvalidError) {
      return NextResponse.json(
        { error: 'Your Spotify session has expired. Please reconnect.', needsReauth: true },
        { status: 401 }
      );
    }
    const message = err instanceof Error ? err.message : 'Failed to load playlists';
    console.error('[spotify/playlists] Error:', err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
