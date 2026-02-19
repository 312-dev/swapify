import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { SessionData, sessionOptions } from '@/lib/session';
import { getSpotifyProfile } from '@/lib/spotify';
import { encrypt } from '@/lib/crypto';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { generateId } from '@/lib/utils';
import type { SpotifyTokenResponse } from '@/types/spotify';
import { logger } from '@/lib/logger';
import { spotifyConfig } from '@/lib/spotify-config';

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

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: session.spotifyClientId,
      code_verifier: session.codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    logger.error(`Token exchange failed: ${err}`);
    return NextResponse.redirect(new URL('/login?error=token_exchange', baseUrl));
  }

  const tokenData: SpotifyTokenResponse = await tokenRes.json();

  // Get user profile
  const profile = await getSpotifyProfile(tokenData.access_token);
  const avatarUrl = profile.images?.at(-1)?.url ?? null;

  // Upsert user in DB
  const existingUser = await db.query.users.findFirst({
    where: eq(users.spotifyId, profile.id),
  });

  // Enforce dev mode user cap (Spotify allows max 5 users in dev mode)
  if (spotifyConfig.devMode && !existingUser) {
    const result = await db.select({ count: sql<number>`count(*)` }).from(users);
    const userCount = result[0]?.count ?? 0;
    if (userCount >= spotifyConfig.maxUsers) {
      logger.warn(`[Swapify] Dev mode user limit reached (${userCount}/${spotifyConfig.maxUsers})`);
      return NextResponse.redirect(new URL('/login?error=dev_mode_user_limit', baseUrl));
    }
  }

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
    await db
      .update(users)
      .set({
        displayName: profile.display_name,
        avatarUrl: avatarUrl,
        accessToken: encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token
          ? encrypt(tokenData.refresh_token)
          : existingUser.refreshToken,
        tokenExpiresAt: Math.floor(Date.now() / 1000) + tokenData.expires_in,
        spotifyClientId: session.spotifyClientId,
      })
      .where(eq(users.id, userId));
  } else {
    userId = generateId();
    await db.insert(users).values({
      id: userId,
      spotifyId: profile.id,
      displayName: profile.display_name,
      avatarUrl: avatarUrl,
      accessToken: encrypt(tokenData.access_token),
      refreshToken: encrypt(tokenData.refresh_token!),
      tokenExpiresAt: Math.floor(Date.now() / 1000) + tokenData.expires_in,
      spotifyClientId: session.spotifyClientId,
    });
  }

  // Set session
  const returnTo = session.returnTo;
  session.userId = userId;
  session.spotifyId = profile.id;
  session.displayName = profile.display_name;
  session.avatarUrl = avatarUrl ?? undefined;
  session.codeVerifier = undefined;
  session.spotifyClientId = undefined;
  session.returnTo = undefined;
  await session.save();

  return NextResponse.redirect(new URL(returnTo || '/dashboard', baseUrl));
}
