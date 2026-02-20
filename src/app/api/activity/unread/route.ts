import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { playlistMembers, playlistTracks } from '@/db/schema';
import { eq, and, gt, ne, isNull, sql } from 'drizzle-orm';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const memberships = await db.query.playlistMembers.findMany({
    where: eq(playlistMembers.userId, user.id),
  });

  if (memberships.length === 0) {
    return NextResponse.json({ count: 0 });
  }

  // Count unread tracks across all playlists:
  // - added after the user's lastActivitySeenAt (or joinedAt as fallback)
  // - not added by the user themselves
  // - not removed
  const conditions = memberships.map((m) => {
    const seenAt = m.lastActivitySeenAt ?? m.joinedAt;
    return and(
      eq(playlistTracks.playlistId, m.playlistId),
      gt(playlistTracks.addedAt, seenAt),
      ne(playlistTracks.addedByUserId, user.id),
      isNull(playlistTracks.removedAt)
    );
  });

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(playlistTracks)
    .where(sql`(${sql.join(conditions, sql` OR `)})`);

  return NextResponse.json({ count: Number(result[0]?.count ?? 0) });
}
