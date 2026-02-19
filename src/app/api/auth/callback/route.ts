import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { SessionData, sessionOptions } from '@/lib/session';
import { getSpotifyProfile } from '@/lib/spotify';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/utils';
import type { SpotifyTokenResponse } from '@/types/spotify';

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

  // Exchange code for tokens
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
      client_id: process.env.SPOTIFY_CLIENT_ID!,
      code_verifier: session.codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error('Token exchange failed:', err);
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

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
    await db
      .update(users)
      .set({
        displayName: profile.display_name,
        avatarUrl: avatarUrl,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token ?? existingUser.refreshToken,
        tokenExpiresAt: Math.floor(Date.now() / 1000) + tokenData.expires_in,
      })
      .where(eq(users.id, userId));
  } else {
    userId = generateId();
    await db.insert(users).values({
      id: userId,
      spotifyId: profile.id,
      displayName: profile.display_name,
      avatarUrl: avatarUrl,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token!,
      tokenExpiresAt: Math.floor(Date.now() / 1000) + tokenData.expires_in,
    });
  }

  // Set session
  const returnTo = session.returnTo;
  session.userId = userId;
  session.spotifyId = profile.id;
  session.displayName = profile.display_name;
  session.avatarUrl = avatarUrl ?? undefined;
  session.codeVerifier = undefined;
  session.returnTo = undefined;
  await session.save();

  return NextResponse.redirect(new URL(returnTo || '/dashboard', baseUrl));
}
