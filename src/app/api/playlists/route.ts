import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { playlists, playlistMembers, trackListens } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { createPlaylist } from '@/lib/spotify';
import { generateId, generateInviteCode, getFirstName, formatPlaylistName } from '@/lib/utils';

// GET /api/playlists — list user's playlists
export async function GET() {
  const user = await requireAuth();

  const [memberships, userListens] = await Promise.all([
    db.query.playlistMembers.findMany({
      where: eq(playlistMembers.userId, user.id),
      with: {
        playlist: {
          with: {
            owner: true,
            members: { with: { user: true } },
            tracks: true,
          },
        },
      },
      orderBy: desc(playlistMembers.joinedAt),
    }),
    db.query.trackListens.findMany({
      where: eq(trackListens.userId, user.id),
    }),
  ]);

  const listenedSet = new Set(userListens.map((l) => `${l.playlistId}:${l.spotifyTrackId}`));

  const result = memberships.map((m) => {
    const activeTracks = m.playlist.tracks.filter((t) => !t.removedAt);
    const unplayedCount = activeTracks.filter(
      (t) => t.addedByUserId !== user.id && !listenedSet.has(`${m.playlist.id}:${t.spotifyTrackId}`)
    ).length;

    return {
      ...m.playlist,
      memberCount: m.playlist.members.length,
      activeTrackCount: activeTracks.length,
      unplayedCount,
      members: m.playlist.members.map((mem) => ({
        id: mem.user.id,
        displayName: mem.user.displayName,
        avatarUrl: mem.user.avatarUrl,
      })),
    };
  });

  return NextResponse.json(result);
}

// POST /api/playlists — create a new playlist
export async function POST(request: NextRequest) {
  const user = await requireAuth();
  const body = await request.json();
  const { name, description } = body;

  const defaultName = name || formatPlaylistName([getFirstName(user.displayName)]);
  const playlistId = generateId();
  const inviteCode = generateInviteCode();

  // Create Spotify playlist
  const spotifyPlaylist = await createPlaylist(user.id, defaultName, description);

  // Insert playlist
  await db.insert(playlists).values({
    id: playlistId,
    name: defaultName,
    description: description || null,
    spotifyPlaylistId: spotifyPlaylist.id,
    ownerId: user.id,
    inviteCode,
  });

  // Owner auto-joins
  await db.insert(playlistMembers).values({
    id: generateId(),
    playlistId: playlistId,
    userId: user.id,
  });

  const playlist = await db.query.playlists.findFirst({
    where: eq(playlists.id, playlistId),
    with: { owner: true, members: { with: { user: true } } },
  });

  return NextResponse.json({
    ...playlist,
    inviteCode,
    spotifyUrl: spotifyPlaylist.external_urls.spotify,
  });
}
