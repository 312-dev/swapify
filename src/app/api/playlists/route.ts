import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getSession } from '@/lib/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/db';
import { playlists, playlistMembers, trackListens, playlistTracks } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import {
  createPlaylist,
  uploadPlaylistImage,
  getPlaylistDetails,
  updatePlaylistDetails,
  getPlaylistItems,
  addItemsToPlaylist,
  TokenInvalidError,
} from '@/lib/spotify';
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

  const limited = checkRateLimit(`mutation:${user.id}`, RATE_LIMITS.mutation);
  if (limited) return limited;

  const session = await getSession();
  const circleId = session.activeCircleId;
  if (!circleId) {
    return NextResponse.json({ error: 'No active circle selected' }, { status: 400 });
  }

  const body = await request.json();
  const { name, description, imageBase64, importSpotifyPlaylistId, importMode } = body;

  if (importSpotifyPlaylistId) {
    // --- Import existing Spotify playlist ---
    if (!importMode || !['update', 'duplicate'].includes(importMode)) {
      return NextResponse.json(
        { error: 'importMode must be "update" or "duplicate"' },
        { status: 400 }
      );
    }

    // Check not already imported in this circle
    const alreadyImported = await db.query.playlists.findFirst({
      where: and(
        eq(playlists.spotifyPlaylistId, importSpotifyPlaylistId),
        eq(playlists.circleId, circleId)
      ),
    });
    if (alreadyImported) {
      return NextResponse.json({ error: 'This playlist is already a Swaplist' }, { status: 409 });
    }

    try {
      // Fetch source playlist info and tracks
      const sourceDetails = await getPlaylistDetails(user.id, circleId, importSpotifyPlaylistId);
      const sourceTracks = await getPlaylistItems(user.id, circleId, importSpotifyPlaylistId);

      let targetSpotifyPlaylistId: string;
      let playlistName: string;
      let playlistDescription: string | null;
      let playlistImageUrl: string | null;

      if (importMode === 'update') {
        // Make existing playlist collaborative + private
        await updatePlaylistDetails(user.id, circleId, importSpotifyPlaylistId, {
          collaborative: true,
          public: false,
        });
        targetSpotifyPlaylistId = importSpotifyPlaylistId;
        playlistName = name || sourceDetails.name;
        playlistDescription = description ?? sourceDetails.description;
        playlistImageUrl = sourceDetails.imageUrl;
      } else {
        // Duplicate: create new playlist + copy tracks
        const newName = name || sourceDetails.name;
        const spotifyPlaylist = await createPlaylist(
          user.id,
          circleId,
          newName,
          description ?? sourceDetails.description ?? undefined
        );
        targetSpotifyPlaylistId = spotifyPlaylist.id;

        // Copy tracks in batches of 100
        const uris = sourceTracks.map((item) => item.track.uri);
        for (let i = 0; i < uris.length; i += 100) {
          await addItemsToPlaylist(
            user.id,
            circleId,
            targetSpotifyPlaylistId,
            uris.slice(i, i + 100)
          );
        }

        playlistName = newName;
        playlistDescription = description ?? sourceDetails.description;
        playlistImageUrl = sourceDetails.imageUrl;
      }

      // Create DB record
      const playlistId = generateId();
      const inviteCode = generateInviteCode();
      await db.insert(playlists).values({
        id: playlistId,
        name: playlistName,
        description: playlistDescription,
        spotifyPlaylistId: targetSpotifyPlaylistId,
        ownerId: user.id,
        circleId,
        inviteCode,
        imageUrl: playlistImageUrl,
      });

      // Owner auto-joins
      await db.insert(playlistMembers).values({
        id: generateId(),
        playlistId,
        userId: user.id,
      });

      // Bulk insert tracks into DB
      if (sourceTracks.length > 0) {
        await db.insert(playlistTracks).values(
          sourceTracks.map((item) => ({
            id: generateId(),
            playlistId,
            spotifyTrackUri: item.track.uri,
            spotifyTrackId: item.track.id,
            trackName: item.track.name,
            artistName: item.track.artists.map((a) => a.name).join(', '),
            albumName: item.track.album?.name || null,
            albumImageUrl: item.track.album?.images?.[0]?.url || null,
            durationMs: item.track.duration_ms || null,
            addedByUserId: user.id,
          }))
        );
      }

      const playlist = await db.query.playlists.findFirst({
        where: eq(playlists.id, playlistId),
        with: { owner: true, members: { with: { user: true } } },
      });

      return NextResponse.json({ ...playlist, inviteCode });
    } catch (err) {
      if (err instanceof TokenInvalidError) {
        return NextResponse.json(
          { error: 'Your Spotify session has expired. Please reconnect.', needsReauth: true },
          { status: 401 }
        );
      }
      throw err;
    }
  }

  const defaultName = name || formatPlaylistName([getFirstName(user.displayName)]);
  const playlistId = generateId();
  const inviteCode = generateInviteCode();

  try {
    // Create Spotify playlist
    const spotifyPlaylist = await createPlaylist(user.id, circleId, defaultName, description);

    // Upload cover image if provided
    let imageUrl: string | null = null;
    if (imageBase64) {
      await uploadPlaylistImage(user.id, circleId, spotifyPlaylist.id, imageBase64);
      const details = await getPlaylistDetails(user.id, circleId, spotifyPlaylist.id);
      imageUrl = details.imageUrl;
    }

    // Insert playlist
    await db.insert(playlists).values({
      id: playlistId,
      name: defaultName,
      description: description || null,
      spotifyPlaylistId: spotifyPlaylist.id,
      ownerId: user.id,
      circleId,
      inviteCode,
      imageUrl,
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
  } catch (err) {
    if (err instanceof TokenInvalidError) {
      return NextResponse.json(
        { error: 'Your Spotify session has expired. Please reconnect.', needsReauth: true },
        { status: 401 }
      );
    }
    throw err;
  }
}
