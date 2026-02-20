import { Suspense } from 'react';
import { requireVerifiedEmail } from '@/lib/auth';
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
  const user = await requireVerifiedEmail();
  const { playlistId } = await params;

  const membership = await db.query.playlistMembers.findFirst({
    where: and(eq(playlistMembers.playlistId, playlistId), eq(playlistMembers.userId, user.id)),
  });
  if (!membership) notFound();

  const playlist = await db.query.playlists.findFirst({
    where: eq(playlists.id, playlistId),
    with: { owner: true, circle: true },
  });
  if (!playlist) notFound();

  return (
    <Suspense>
      <PlaylistDetailClient
        playlistId={playlistId}
        playlistName={playlist.name}
        playlistDescription={playlist.description}
        playlistImageUrl={playlist.imageUrl}
        isOwner={playlist.ownerId === user.id}
        ownerId={playlist.ownerId}
        currentUserId={user.id}
        spotifyPlaylistId={playlist.spotifyPlaylistId}
        vibeName={playlist.vibeName}
        circleInviteCode={playlist.circle.inviteCode}
        circleName={playlist.circle.name}
        circleId={playlist.circle.id}
        spotifyClientId={playlist.circle.spotifyClientId}
      />
    </Suspense>
  );
}
