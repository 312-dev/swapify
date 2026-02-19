import { z } from 'zod';

const envSchema = z.object({
  // Spotify OAuth (optional — can be passed dynamically via login flow)
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_REDIRECT_URI: z.string().optional(),

  // Session
  IRON_SESSION_PASSWORD: z.string().min(32, 'IRON_SESSION_PASSWORD must be at least 32 characters'),

  // Polling
  POLL_SECRET: z.string().min(16, 'POLL_SECRET must be at least 16 characters'),
  POLL_INTERVAL_MS: z.coerce.number().positive().default(30000),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL'),

  // Database
  DATABASE_URL: z.string().optional(),
  DATABASE_PATH: z.string().optional(),

  // Email (optional)
  RESEND_API_KEY: z.string().optional(),

  // Push notifications (optional)
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),

  // Token encryption (optional)
  TOKEN_ENCRYPTION_KEY: z.string().optional(),

  // AI — vibe name generation (optional)
  ANTHROPIC_API_KEY: z.string().optional(),

  // Spotify dev mode — restricts to 5 users, conservative rate limits
  SPOTIFY_DEV_MODE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | undefined;

export function validateEnv(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${formatted}`);
  }

  _env = result.data;
  return _env;
}

/** Lazy proxy — validates on first property access, not at import time (safe for build). */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return validateEnv()[prop as keyof Env];
  },
});
