import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { playlistMembers, playlists } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { playlistId, circleId } = body as { playlistId?: string; circleId?: string };
  const now = new Date();

  if (playlistId) {
    // Mark a single playlist's activity as read
    await db
      .update(playlistMembers)
      .set({ lastActivitySeenAt: now })
      .where(and(eq(playlistMembers.userId, user.id), eq(playlistMembers.playlistId, playlistId)));
  } else if (circleId) {
    // Mark all playlists in a circle as read
    const circlePlaylists = await db.query.playlists.findMany({
      where: eq(playlists.circleId, circleId),
      columns: { id: true },
    });
    const playlistIds = circlePlaylists.map((p) => p.id);
    if (playlistIds.length > 0) {
      await db
        .update(playlistMembers)
        .set({ lastActivitySeenAt: now })
        .where(
          and(eq(playlistMembers.userId, user.id), inArray(playlistMembers.playlistId, playlistIds))
        );
    }
  } else {
    // Mark all activity as read
    await db
      .update(playlistMembers)
      .set({ lastActivitySeenAt: now })
      .where(eq(playlistMembers.userId, user.id));
  }

  return NextResponse.json({ ok: true });
}
