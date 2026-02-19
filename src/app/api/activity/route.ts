import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { playlistMembers, playlistTracks } from '@/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get user's playlist IDs
  const memberships = await db.query.playlistMembers.findMany({
    where: eq(playlistMembers.userId, user.id),
  });
  const playlistIds = memberships.map((m) => m.playlistId);

  if (playlistIds.length === 0) {
    return NextResponse.json({ events: [] });
  }

  // Get recent tracks added (last 50)
  const recentTracks = await db.query.playlistTracks.findMany({
    where: inArray(playlistTracks.playlistId, playlistIds),
    with: {
      addedBy: true,
      playlist: true,
    },
    orderBy: desc(playlistTracks.addedAt),
    limit: 50,
  });

  // Build activity events from track additions
  const events = recentTracks.map((track) => ({
    id: `track-${track.id}`,
    type: 'track_added' as const,
    timestamp: track.addedAt,
    user: {
      displayName: track.addedBy.displayName,
      avatarUrl: track.addedBy.avatarUrl,
    },
    data: {
      trackName: track.trackName,
      artistName: track.artistName,
      albumImageUrl: track.albumImageUrl,
      playlistName: track.playlist.name,
      playlistId: track.playlist.id,
    },
  }));

  // Sort by timestamp descending
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({ events: events.slice(0, 30) });
}
