import { NextResponse } from 'next/server';
import { requireAuth, getSession } from '@/lib/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { getPlaylistDetails, TokenInvalidError } from '@/lib/spotify';

export async function GET(_req: Request, { params }: { params: Promise<{ playlistId: string }> }) {
  const user = await requireAuth();

  const session = await getSession();
  const circleId = session.activeCircleId;
  if (!circleId) {
    return NextResponse.json({ error: 'No active circle selected' }, { status: 400 });
  }

  const limited = checkRateLimit(`api:${user.id}`, RATE_LIMITS.api);
  if (limited) return limited;

  const { playlistId } = await params;

  try {
    const details = await getPlaylistDetails(user.id, circleId, playlistId);
    return NextResponse.json(details);
  } catch (err) {
    if (err instanceof TokenInvalidError) {
      return NextResponse.json(
        { error: 'Your Spotify session has expired. Please reconnect.', needsReauth: true },
        { status: 401 }
      );
    }
    const message = err instanceof Error ? err.message : 'Failed to load playlist details';
    console.error('[spotify/playlists/details] Error:', err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
