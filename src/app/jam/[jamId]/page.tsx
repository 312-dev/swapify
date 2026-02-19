import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { jams, jamMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import JamDetailClient from "./JamDetailClient";

export default async function JamDetailPage({
  params,
}: {
  params: Promise<{ jamId: string }>;
}) {
  const user = await requireAuth();
  const { jamId } = await params;

  const membership = await db.query.jamMembers.findFirst({
    where: and(eq(jamMembers.jamId, jamId), eq(jamMembers.userId, user.id)),
  });
  if (!membership) notFound();

  const jam = await db.query.jams.findFirst({
    where: eq(jams.id, jamId),
    with: { owner: true },
  });
  if (!jam) notFound();

  return (
    <JamDetailClient
      jamId={jamId}
      jamName={jam.name}
      jamDescription={jam.description}
      jamImageUrl={jam.imageUrl}
      inviteCode={jam.inviteCode}
      isOwner={jam.ownerId === user.id}
      currentUserId={user.id}
      spotifyPlaylistId={jam.spotifyPlaylistId}
    />
  );
}
