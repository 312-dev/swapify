import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { redirect } from 'next/navigation';
import { SessionData, sessionOptions } from './session';
import { db } from '@/db';
import { users, circleMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session.userId) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });

  return user ?? null;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

/**
 * Get the current user's membership in their active circle.
 * Returns the circle_members row with the circle relation (includes spotifyClientId, name, host),
 * or null if no active circle is set or the user is not a member.
 */
export async function getActiveCircleMembership() {
  const session = await getSession();
  if (!session.userId || !session.activeCircleId) return null;

  const membership = await db.query.circleMembers.findFirst({
    where: and(
      eq(circleMembers.userId, session.userId),
      eq(circleMembers.circleId, session.activeCircleId)
    ),
    with: {
      circle: {
        with: {
          host: true,
        },
      },
    },
  });

  return membership ?? null;
}

/**
 * Require an authenticated user with an active circle membership.
 * Redirects to /login if not authenticated, or /dashboard if no active circle.
 * Returns { user, membership } where membership includes the circle relation.
 */
export async function requireCircle() {
  const user = await requireAuth();
  const membership = await getActiveCircleMembership();

  if (!membership) {
    redirect('/dashboard');
  }

  return { user, membership };
}

/**
 * Get all circle memberships for a given user, including circle details and host info.
 */
export async function getUserCircles(userId: string) {
  const memberships = await db.query.circleMembers.findMany({
    where: eq(circleMembers.userId, userId),
    with: {
      circle: {
        with: {
          host: true,
        },
      },
    },
  });

  return memberships;
}
