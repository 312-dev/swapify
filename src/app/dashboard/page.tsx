import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { jamMembers } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const user = await requireAuth();

  const memberships = await db.query.jamMembers.findMany({
    where: eq(jamMembers.userId, user.id),
    with: {
      jam: {
        with: {
          members: { with: { user: true } },
          tracks: true,
        },
      },
    },
    orderBy: desc(jamMembers.joinedAt),
  });

  const jams = memberships.map((m) => ({
    id: m.jam.id,
    name: m.jam.name,
    description: m.jam.description,
    imageUrl: m.jam.imageUrl,
    memberCount: m.jam.members.length,
    activeTrackCount: m.jam.tracks.filter((t) => !t.removedAt).length,
    members: m.jam.members.map((mem) => ({
      id: mem.user.id,
      displayName: mem.user.displayName,
      avatarUrl: mem.user.avatarUrl,
    })),
  }));

  return <DashboardClient jams={jams} userName={user.displayName} />;
}
