import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { playlists, playlistMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import PlaylistDetailClient from './PlaylistDetailClient';

export default async function PlaylistDetailPage({
  params,
}: {
  params: Promise<{ playlistId: string }>;
}) {
  const user = await requireAuth();
  const { playlistId } = await params;

  const membership = await db.query.playlistMembers.findFirst({
    where: and(eq(playlistMembers.playlistId, playlistId), eq(playlistMembers.userId, user.id)),
  });
  if (!membership) notFound();

  const playlist = await db.query.playlists.findFirst({
    where: eq(playlists.id, playlistId),
    with: { owner: true },
  });
  if (!playlist) notFound();

  return (
    <Suspense>
      <PlaylistDetailClient
        playlistId={playlistId}
        playlistName={playlist.name}
        playlistDescription={playlist.description}
        playlistImageUrl={playlist.imageUrl}
        inviteCode={playlist.inviteCode}
        isOwner={playlist.ownerId === user.id}
        ownerId={playlist.ownerId}
        currentUserId={user.id}
        spotifyPlaylistId={playlist.spotifyPlaylistId}
        vibeName={playlist.vibeName}
        ownerSpotifyClientId={playlist.owner.spotifyClientId ?? undefined}
      />
    </Suspense>
  );
}
