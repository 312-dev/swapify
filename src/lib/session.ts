import { SessionOptions } from "iron-session";

export interface SessionData {
  userId?: string;
  spotifyId?: string;
  displayName?: string;
  avatarUrl?: string;
  codeVerifier?: string;
  returnTo?: string;
}

export const sessionOptions: SessionOptions = {
  password: process.env.IRON_SESSION_PASSWORD!,
  cookieName: "deepdigs_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};
