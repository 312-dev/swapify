import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { SessionData, sessionOptions } from '@/lib/session';
import { getSpotifyProfile } from '@/lib/spotify';
import { encrypt } from '@/lib/crypto';
import { db } from '@/db';
import { users, circles, circleMembers, circleInvites } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { generateId, generateInviteCode } from '@/lib/utils';
import type { SpotifyTokenResponse } from '@/types/spotify';
import { logger } from '@/lib/logger';
import { spotifyConfig } from '@/lib/spotify-config';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Encrypted token data ready for DB storage. */
interface EncryptedTokens {
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: number;
}

/** Successful circle resolution — used to set session fields. */
interface CircleResult {
  circleId: string;
  circleName: string;
}

/** Redirect signal from a handler — means we should abort and redirect. */
interface RedirectResult {
  redirectTo: string;
}

function isRedirect(result: CircleResult | RedirectResult): result is RedirectResult {
  return 'redirectTo' in result;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Encrypt tokens from the Spotify token response. */
function encryptTokens(tokenData: SpotifyTokenResponse): EncryptedTokens {
  return {
    accessToken: encrypt(tokenData.access_token),
    refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
    tokenExpiresAt: Math.floor(Date.now() / 1000) + tokenData.expires_in,
  };
}

/** Upsert user profile (no tokens — those live in circle_members). Returns userId and whether user is new. */
async function upsertUserProfile(
  spotifyId: string,
  displayName: string,
  avatarUrl: string | null
): Promise<{ userId: string; isNewUser: boolean }> {
  const existingUser = await db.query.users.findFirst({
    where: eq(users.spotifyId, spotifyId),
  });

  if (existingUser) {
    await db.update(users).set({ displayName, avatarUrl }).where(eq(users.id, existingUser.id));
    return { userId: existingUser.id, isNewUser: false };
  }

  const userId = generateId();
  await db.insert(users).values({
    id: userId,
    spotifyId,
    displayName,
    avatarUrl,
  });
  return { userId, isNewUser: true };
}

/** Count circle members for a given circle. */
async function getCircleMemberCount(circleId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(circleMembers)
    .where(eq(circleMembers.circleId, circleId));
  return result[0]?.count ?? 0;
}

// ─── Scenario Handlers ─────────────────────────────────────────────────────

/** Scenario 1: Create a new circle (first login or "Create Circle" flow). */
async function handleCreateCircle(
  userId: string,
  isNewUser: boolean,
  displayName: string,
  spotifyClientId: string,
  tokens: EncryptedTokens,
  rawRefreshToken: string | undefined
): Promise<CircleResult | RedirectResult> {
  // Dev mode: cap check across all circles using this Spotify client ID
  if (spotifyConfig.devMode && isNewUser) {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(circleMembers)
      .innerJoin(circles, eq(circleMembers.circleId, circles.id))
      .where(eq(circles.spotifyClientId, spotifyClientId));
    const memberCount = result[0]?.count ?? 0;
    if (memberCount >= spotifyConfig.maxUsers) {
      logger.warn(
        `[Swapify] Dev mode user limit reached for client ${spotifyClientId} (${memberCount}/${spotifyConfig.maxUsers})`
      );
      return { redirectTo: '/login?error=dev_mode_user_limit' };
    }
  }

  const circleId = generateId();
  const circleName = `${displayName}'s Circle`;

  await db.insert(circles).values({
    id: circleId,
    name: circleName,
    spotifyClientId,
    hostUserId: userId,
    inviteCode: generateInviteCode(),
    maxMembers: spotifyConfig.devMode ? 5 : 6,
  });

  await db.insert(circleMembers).values({
    id: generateId(),
    circleId,
    userId,
    role: 'host',
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken ?? encrypt(rawRefreshToken!),
    tokenExpiresAt: tokens.tokenExpiresAt,
  });

  return { circleId, circleName };
}

/** Scenario 2: Join an existing circle. */
async function handleJoinCircle(
  userId: string,
  pendingCircleId: string,
  tokens: EncryptedTokens,
  rawRefreshToken: string | undefined
): Promise<CircleResult | RedirectResult> {
  const circle = await db.query.circles.findFirst({
    where: eq(circles.id, pendingCircleId),
  });

  if (!circle) {
    logger.error(`[Swapify] Join failed: circle ${pendingCircleId} not found`);
    return { redirectTo: '/login?error=circle_not_found' };
  }

  if (circle.hostUserId === userId) {
    return { redirectTo: '/dashboard?error=own_circle' };
  }

  const currentMembers = await getCircleMemberCount(pendingCircleId);

  if (currentMembers >= circle.maxMembers) {
    logger.warn(
      `[Swapify] Circle ${pendingCircleId} is full (${currentMembers}/${circle.maxMembers})`
    );
    return { redirectTo: '/login?error=circle_full' };
  }

  if (spotifyConfig.devMode && currentMembers >= spotifyConfig.maxUsers) {
    logger.warn(
      `[Swapify] Dev mode user limit reached for circle ${pendingCircleId} (${currentMembers}/${spotifyConfig.maxUsers})`
    );
    return { redirectTo: '/login?error=dev_mode_user_limit' };
  }

  // Check for existing membership (rejoin scenario)
  const existingMembership = await db.query.circleMembers.findFirst({
    where: and(eq(circleMembers.circleId, pendingCircleId), eq(circleMembers.userId, userId)),
  });

  if (existingMembership) {
    await db
      .update(circleMembers)
      .set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? existingMembership.refreshToken,
        tokenExpiresAt: tokens.tokenExpiresAt,
      })
      .where(eq(circleMembers.id, existingMembership.id));
  } else {
    await db.insert(circleMembers).values({
      id: generateId(),
      circleId: pendingCircleId,
      userId,
      role: 'member',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? encrypt(rawRefreshToken!),
      tokenExpiresAt: tokens.tokenExpiresAt,
    });

    // Notify existing circle members (fire-and-forget)
    const newMember = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (newMember) {
      import('@/lib/notifications').then(({ notifyCircleMembers }) => {
        notifyCircleMembers(
          pendingCircleId,
          userId,
          {
            title: 'New Circle member',
            body: `${newMember.displayName} joined your Circle`,
            url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`,
          },
          'circleJoined'
        );
      });
    }
  }

  return { circleId: circle.id, circleName: circle.name };
}

/** Scenario 3: Re-authenticate tokens for an existing circle membership. */
async function handleReauth(
  userId: string,
  pendingCircleId: string,
  tokens: EncryptedTokens
): Promise<CircleResult | RedirectResult> {
  const membership = await db.query.circleMembers.findFirst({
    where: and(eq(circleMembers.circleId, pendingCircleId), eq(circleMembers.userId, userId)),
  });

  if (!membership) {
    logger.error(
      `[Swapify] Reauth failed: no membership for user ${userId} in circle ${pendingCircleId}`
    );
    return { redirectTo: '/login?error=no_membership' };
  }

  await db
    .update(circleMembers)
    .set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? membership.refreshToken,
      tokenExpiresAt: tokens.tokenExpiresAt,
    })
    .where(eq(circleMembers.id, membership.id));

  const circle = await db.query.circles.findFirst({
    where: eq(circles.id, pendingCircleId),
  });

  return { circleId: pendingCircleId, circleName: circle?.name ?? 'Circle' };
}

// ─── Dispatcher ─────────────────────────────────────────────────────────────

/** Options for resolving which circle action to perform in the callback. */
interface ResolveCircleOptions {
  userId: string;
  isNewUser: boolean;
  displayName: string;
  spotifyClientId: string;
  pendingAction: string | undefined;
  pendingCircleId: string | undefined;
  tokens: EncryptedTokens;
  rawRefreshToken: string | undefined;
}

/** Route the callback to the correct handler based on pendingCircleAction. */
async function resolveCircle(opts: ResolveCircleOptions): Promise<CircleResult | RedirectResult> {
  const { pendingAction, pendingCircleId } = opts;

  if (!pendingAction || pendingAction === 'create') {
    return handleCreateCircle(
      opts.userId,
      opts.isNewUser,
      opts.displayName,
      opts.spotifyClientId,
      opts.tokens,
      opts.rawRefreshToken
    );
  }

  if (pendingAction === 'join' && pendingCircleId) {
    return handleJoinCircle(opts.userId, pendingCircleId, opts.tokens, opts.rawRefreshToken);
  }

  if (pendingAction === 'reauth' && pendingCircleId) {
    return handleReauth(opts.userId, pendingCircleId, opts.tokens);
  }

  logger.error(
    `[Swapify] Unknown callback state: action=${pendingAction}, circleId=${pendingCircleId}`
  );
  return { redirectTo: '/login?error=invalid_callback_state' };
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.url;
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(new URL(`/login?error=${error || 'no_code'}`, baseUrl));
  }

  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  if (!session.codeVerifier) {
    return NextResponse.redirect(new URL('/login?error=no_verifier', baseUrl));
  }

  if (!session.spotifyClientId) {
    return NextResponse.redirect(new URL('/login?error=no_client_id', baseUrl));
  }

  // Exchange authorization code for tokens
  const tokenData = await exchangeCodeForTokens(
    code,
    session.spotifyClientId,
    session.codeVerifier
  );

  if (!tokenData) {
    return NextResponse.redirect(new URL('/login?error=token_exchange', baseUrl));
  }

  // Get user profile from Spotify
  const profile = await getSpotifyProfile(tokenData.access_token);
  // Pick the largest available profile image (Spotify doesn't guarantee sort order)
  const avatarUrl =
    profile.images?.sort(
      (a: { width?: number }, b: { width?: number }) => (b.width ?? 0) - (a.width ?? 0)
    )[0]?.url ?? null;

  // Upsert user profile (no tokens — those live in circle_members)
  const { userId, isNewUser } = await upsertUserProfile(
    profile.id,
    profile.display_name,
    avatarUrl
  );

  // Encrypt tokens for DB storage
  const tokens = encryptTokens(tokenData);

  // Capture transient fields before clearing
  const { pendingCircleAction, pendingCircleId, returnTo, spotifyClientId, pendingInviteToken } =
    session;

  // Resolve the circle based on the pending action
  const result = await resolveCircle({
    userId,
    isNewUser,
    displayName: profile.display_name,
    spotifyClientId,
    pendingAction: pendingCircleAction,
    pendingCircleId,
    tokens,
    rawRefreshToken: tokenData.refresh_token,
  });

  if (isRedirect(result)) {
    return NextResponse.redirect(new URL(result.redirectTo, baseUrl));
  }

  // Auto-verify email from invite token (only if user has no verified email yet)
  if (pendingInviteToken) {
    try {
      const invite = await db.query.circleInvites.findFirst({
        where: eq(circleInvites.inviteToken, pendingInviteToken),
      });

      if (invite && !invite.usedAt && invite.expiresAt >= Date.now()) {
        // Only auto-set email if user doesn't already have one
        const currentUser = await db.query.users.findFirst({
          where: eq(users.id, userId),
        });
        if (currentUser && !currentUser.email) {
          await db
            .update(users)
            .set({
              email: invite.recipientEmail,
              pendingEmail: null,
              emailVerifyToken: null,
              emailVerifyExpiresAt: null,
            })
            .where(eq(users.id, userId));
        }

        // Mark invite as used
        await db
          .update(circleInvites)
          .set({ usedAt: new Date(), usedByUserId: userId })
          .where(eq(circleInvites.id, invite.id));
      }
    } catch (err) {
      logger.error(`[Swapify] Failed to process invite token auto-verify: ${err}`);
    }
  }

  // Set session with circle context
  session.userId = userId;
  session.spotifyId = profile.id;
  session.displayName = profile.display_name;
  session.avatarUrl = avatarUrl ?? undefined;
  session.activeCircleId = result.circleId;
  session.activeCircleName = result.circleName;

  // Clear transient OAuth fields
  session.codeVerifier = undefined;
  session.spotifyClientId = undefined;
  session.pendingCircleId = undefined;
  session.pendingCircleAction = undefined;
  session.pendingInviteToken = undefined;
  session.returnTo = undefined;
  await session.save();

  return NextResponse.redirect(new URL(returnTo || '/dashboard', baseUrl));
}

// ─── Token Exchange ─────────────────────────────────────────────────────────

/** Exchange an authorization code for Spotify tokens. Returns null on failure. */
async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  codeVerifier: string
): Promise<SpotifyTokenResponse | null> {
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    logger.error(`Token exchange failed: ${err}`);
    return null;
  }

  return tokenRes.json();
}
