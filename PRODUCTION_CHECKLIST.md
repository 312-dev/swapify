# Swapify Production Readiness Checklist

## P0 — Must Fix Before Deploy

- [ ] **Rotate all secrets**
  - [ ] Generate strong `IRON_SESSION_PASSWORD` (`openssl rand -base64 32`)
  - [ ] Generate strong `POLL_SECRET`
  - [ ] Generate `TOKEN_ENCRYPTION_KEY` (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)
  - [ ] Rotate `SPOTIFY_CLIENT_ID` if `.env.local` was ever committed

- [x] **Migrate SQLite → PostgreSQL**
  - [x] Dual driver: PGlite (local dev) / node-postgres (production)
  - [x] Schema rewritten with `pgTable`, proper `boolean` and `timestamp` types
  - [x] `src/db/index.ts` — driver selected by `DATABASE_URL` env var
  - [x] Initial Postgres migration generated (`drizzle/0000_mean_selene.sql`)
  - [x] `drizzle.config.ts` updated to `postgresql` dialect
  - [x] Dockerfile updated (removed SQLite data directory)
  - [x] `fly.toml` updated (removed volume mount, `DATABASE_URL` via fly secrets)
  - [x] Migration runner: `npm run db:migrate` (`src/db/migrate.ts`)
  - [ ] Choose provider (Neon / Supabase / Fly Postgres)
  - [ ] Provision production database and set `DATABASE_URL`
  - [ ] Run `npm run db:migrate` against production
  - [ ] Rewrite `seed.ts` to use Drizzle ORM (currently still uses raw better-sqlite3)

- [x] **Add security headers in `next.config.ts`**
  - [x] `Content-Security-Policy`
  - [x] `X-Frame-Options: DENY`
  - [x] `X-Content-Type-Options: nosniff`
  - [x] `Strict-Transport-Security`
  - [x] `Referrer-Policy: strict-origin-when-cross-origin`
  - [x] `Permissions-Policy` (disable camera, mic, geolocation)

- [x] **Add env var validation**
  - [x] Create `src/env.ts` with zod schema (lazy proxy — safe at build time)
  - [x] Validate all required vars on first access
  - [x] Fail fast with clear error messages if missing

## P1 — Fix Soon After Deploy

- [x] **API rate limiting**
  - [x] In-memory token-bucket rate limiter (`src/lib/rate-limit.ts`)
  - [x] Playlist creation: `mutation` profile (20 req/min per user, 8 in dev mode)
  - [x] Track additions: `mutation` profile (20 req/min per user, 8 in dev mode)
  - [x] Email invites: `invite` profile (10/hr per user)
  - [x] Search: `search` profile (30 req/min per user, 10 in dev mode)
  - [x] Invite code resolution: `public` profile (20 req/min per IP)
  - [x] Global Spotify API call budget: rolling 30s window (50 calls dev / 300 production)
  - [x] `SPOTIFY_DEV_MODE` env var: enforces 5-user cap, conservative rate limits, longer polling

- [x] **Encrypt Spotify tokens at rest**
  - [x] AES-256-GCM encrypt/decrypt utility (`src/lib/crypto.ts`)
  - [x] `TOKEN_ENCRYPTION_KEY` env var (optional — plaintext if unset for local dev)
  - [x] Encrypt tokens before DB write in auth callback
  - [x] Decrypt tokens on read in `spotify.ts`
  - [x] Backward-compatible: existing plaintext tokens decrypt transparently

- [x] **Health check endpoint**
  - [x] Create `src/app/api/health/route.ts`
  - [x] Verify DB connectivity in handler
  - [x] Return `{ status: "ok" }` or `503`
  - [x] Wire up in `fly.toml` http checks

- [x] **Sanitize error responses**
  - [x] Audit all API routes for leaked error details
  - [x] Replace Spotify error passthrough with generic messages
  - [x] Log full errors server-side, return safe messages to client

## P2 — Harden

- [x] **Structured logging**
  - [x] Pino logger (`src/lib/logger.ts`)
  - [x] Replaced `console.*` in polling.ts, auth callback, health check
  - [x] JSON output in production, debug level in dev

- [x] **CSRF protection**
  - [x] Evaluated: `sameSite: 'lax'` + `httpOnly` cookies are sufficient
  - [x] All mutations use `fetch()` (not form submissions) — no cross-origin POST risk
  - [x] Token-based CSRF not needed given architecture (can add later if needed)

- [x] **Enable Dependabot**
  - [x] `.github/dependabot.yml` — weekly npm + GitHub Actions updates
  - [x] Minor/patch grouped, 10 PR limit

- [ ] **AI vibe name generation**
  - [ ] Create Anthropic API key at [console.anthropic.com](https://console.anthropic.com)
  - [ ] `fly secrets set ANTHROPIC_API_KEY=sk-ant-...`
  - [ ] Uses Claude Haiku (~$0.0001/generation) — generates Daylist-style labels for playlists with >3 tracks

- [ ] **Database backups**
  - [ ] Verify managed Postgres provider has automated backups
  - [ ] Configure backup retention policy
  - [ ] Test restore procedure
