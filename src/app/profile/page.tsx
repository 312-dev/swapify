import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { jamMembers, jamTracks } from "@/db/schema";
import { eq } from "drizzle-orm";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const user = await requireAuth();

  // Count user's jams
  const memberships = await db.query.jamMembers.findMany({
    where: eq(jamMembers.userId, user.id),
  });

  // Count tracks added by user
  const tracksAdded = await db.query.jamTracks.findMany({
    where: eq(jamTracks.addedByUserId, user.id),
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
        autoNegativeReactions: user.autoNegativeReactions,
      }}
      stats={{
        jamCount: memberships.length,
        trackCount: tracksAdded.length,
      }}
    />
  );
}
