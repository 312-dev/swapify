import { SessionOptions } from 'iron-session';

export interface SessionData {
  userId?: string;
  spotifyId?: string;
  displayName?: string;
  avatarUrl?: string;
  activeCircleId?: string; // Currently selected circle
  activeCircleName?: string; // For display without DB round-trip
  // OAuth flow transient fields (cleared after callback)
  codeVerifier?: string;
  spotifyClientId?: string;
  pendingCircleId?: string; // Circle being joined during OAuth
  pendingCircleAction?: 'create' | 'join' | 'reauth'; // What to do in callback
  returnTo?: string;
}

export const sessionOptions: SessionOptions = {
  password: process.env.IRON_SESSION_PASSWORD!,
  cookieName: 'swapify_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};
