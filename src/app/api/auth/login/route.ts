import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { SessionData, sessionOptions } from '@/lib/session';

function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values)
    .map((v) => possible[v % possible.length])
    .join('');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function GET(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get('returnTo');
  const clientId = request.nextUrl.searchParams.get('clientId') ?? process.env.SPOTIFY_CLIENT_ID;
  const circleId = request.nextUrl.searchParams.get('circleId');
  const circleAction = request.nextUrl.searchParams.get('circleAction') as
    | 'create'
    | 'join'
    | 'reauth'
    | null;

  if (!clientId) {
    return NextResponse.redirect(new URL('/login?error=no_client_id', request.url));
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;

  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(16);

  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  session.codeVerifier = codeVerifier;
  session.spotifyClientId = clientId;
  if (returnTo) session.returnTo = returnTo;
  if (circleId) session.pendingCircleId = circleId;
  if (circleAction) session.pendingCircleAction = circleAction;
  await session.save();

  const scopes = [
    'user-read-private',
    'user-read-recently-played',
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-private',
    'playlist-modify-public',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'user-library-read',
    'user-library-modify',
  ].join(' ');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  });

  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`);
}
