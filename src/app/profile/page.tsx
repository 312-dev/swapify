import { requireVerifiedEmail } from '@/lib/auth';
import { db } from '@/db';
import { playlistMembers, playlistTracks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import ProfileClient from './ProfileClient';

export default async function ProfilePage() {
  const user = await requireVerifiedEmail();

  // Count user's playlists
  const memberships = await db.query.playlistMembers.findMany({
    where: eq(playlistMembers.userId, user.id),
  });

  // Count tracks added by user
  const tracksAdded = await db.query.playlistTracks.findMany({
    where: eq(playlistTracks.addedByUserId, user.id),
  });

  return (
    <ProfileClient
      user={{
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        email: user.email,
        pendingEmail: user.pendingEmail,
        notifyPush: user.notifyPush,
        notifyEmail: user.notifyEmail,
        notificationPrefs: user.notificationPrefs ?? null,
        autoNegativeReactions: user.autoNegativeReactions,
      }}
      stats={{
        jamCount: memberships.length,
        trackCount: tracksAdded.length,
      }}
    />
  );
}
