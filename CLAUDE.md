# Swapify

Spotify collaborative playlist app. Users create shared playlists ("Swaplists"), add tracks, and react to each other's picks via swipe gestures.

**Rebrand history**: JamJar -> Deep Digs -> **Swapify**. Playlists are called **"Swaplists"** in the UI.

## Tech Stack

- **Framework**: Next.js 16 App Router + TypeScript + React 19
- **Styling**: Tailwind CSS v4 + shadcn/ui (new-york style, neutral base, dark-only theme)
- **Database**: Drizzle ORM + PostgreSQL (`pgTable` from `drizzle-orm/pg-core`)
- **Auth**: Manual Spotify OAuth PKCE flow (no NextAuth) + iron-session
- **Animations**: Motion (Framer Motion v11+) — import from `"motion/react"` NOT `"framer-motion"`
- **Deployment**: Fly.io (standalone output, Docker)
- **Notifications**: Web push (web-push) + email (Resend)

## Database: Dual Driver Setup

The app uses **PGlite** (embedded Postgres, file-based) for local dev and **node-postgres** for production. Both speak native Postgres SQL, so migrations work identically on both.

- `DATABASE_URL` env var present -> production Postgres (node-postgres)
- `DATABASE_URL` absent -> PGlite at `./data/swapify-pg` (or `DATABASE_PATH`)
- Driver selection in [src/db/index.ts](src/db/index.ts) uses `require()` for dynamic loading
- Type safety via `import type` from node-postgres (erased at compile time, avoids bundling)
- **`serverExternalPackages`** in [next.config.ts](next.config.ts) prevents Turbopack from bundling PGlite/pg/pino

### Migration Pipeline

```bash
npm run db:generate   # Generate SQL from schema changes (drizzle-kit generate)
npm run db:migrate    # Run migrations (src/db/migrate.ts — dual-driver aware)
npm run db:seed       # Seed data (needs rewrite — still uses raw better-sqlite3)
```

Migrations live in `drizzle/*.sql`. Archived SQLite migrations in `drizzle-sqlite-archive/`.

**IMPORTANT**: If you encounter "column X does not exist" or similar schema errors, always run `npm run db:migrate` first — the schema likely has pending migrations that haven't been applied to the local PGlite database.

### Schema Tables

`users`, `playlists`, `playlist_members`, `playlist_tracks`, `track_listens`, `track_reactions`, `email_invites`, `push_subscriptions`

Schema exports use generic camelCase naming: `playlists`, `playlistMembers`, `playlistTracks`, etc.

## Project Structure

### Pages (App Router)

| Route | Description |
|---|---|
| `/` | Landing / login redirect |
| `/login` | Spotify OAuth login |
| `/dashboard` | Swaplist list + Create/Join bottom sheets |
| `/playlist/[playlistId]` | Playlist detail with swipeable track cards |
| `/playlist/[playlistId]/settings` | Playlist settings (owner only) |
| `/playlist/join` | Deep link join flow |
| `/activity` | Activity feed |
| `/profile` | User profile + notification preferences |

### Key Components

| Component | Purpose |
|---|---|
| `LayoutShell` | Wraps all pages: LazyMotion + BottomNav |
| `BottomNav` | 3 tabs: Swaplists (/dashboard), Activity (/activity), Profile (/profile) |
| `SwipeableTrackCard` | Swipe-right = thumbs_up, swipe-left = thumbs_down |
| `GlassDrawer` | Slide-up panel (shadcn Drawer/Vaul) with drag-to-dismiss |
| `PlaylistCard` | Dashboard playlist card |
| `ReactionOverlay` | Emoji reaction picker overlay |
| `TrackSearch` | Spotify track search for adding to playlists |
| `ShareSheet` | Share/invite bottom sheet |
| `PlaylistTabs` | Tab navigation within playlist detail (Active, Liked, Outcasts, History) |

### Key Libraries

| File | Purpose |
|---|---|
| `src/lib/spotify.ts` | All Spotify API calls (uses owner's token for playlist mutations) |
| `src/lib/polling.ts` | Listen detection via Spotify playback polling |
| `src/lib/auth.ts` | `getSession()`, `getCurrentUser()`, `requireAuth()` |
| `src/lib/session.ts` | iron-session config (cookie: `swapify_session`, 30-day expiry) |
| `src/lib/spotify-config.ts` | Dev mode config, global API call budget tracker |
| `src/lib/rate-limit.ts` | In-memory token-bucket rate limiter (dev-mode-aware) |
| `src/lib/crypto.ts` | AES-256-GCM token encryption (optional via `TOKEN_ENCRYPTION_KEY`) |
| `src/lib/notifications.ts` | Push + email notification dispatch |
| `src/lib/logger.ts` | Pino structured logging |
| `src/lib/motion.ts` | Motion presets: `springs.snappy/smooth/gentle`, `fade`, `STAGGER_DELAY` |
| `src/lib/utils.ts` | `cn()` (clsx + tailwind-merge), `generateId()`, `formatPlaylistName()` |
| `src/lib/vibe-sort.ts` | Auto-sort playlist tracks by audio features |
| `src/env.ts` | Zod env validation (lazy proxy — validates on first access, safe at build) |

## Environment Variables

### Required
- `SPOTIFY_CLIENT_ID` — Spotify app client ID
- `SPOTIFY_REDIRECT_URI` — OAuth callback URL
- `IRON_SESSION_PASSWORD` — Min 32 chars, session encryption key
- `POLL_SECRET` — Min 16 chars, polling endpoint auth
- `NEXT_PUBLIC_APP_URL` — Full app URL (e.g., `https://swapify.312.dev`)

### Optional
- `DATABASE_URL` — Production Postgres connection string (absent = PGlite local)
- `DATABASE_PATH` — Override PGlite data directory (default: `./data/swapify-pg`)
- `TOKEN_ENCRYPTION_KEY` — 32-byte base64 key for Spotify token encryption at rest
- `RESEND_API_KEY` — Email sending via Resend
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` — Web push
- `POLL_INTERVAL_MS` — Polling interval (default: 30000, dev mode default: 60000)
- `SPOTIFY_DEV_MODE` — Set to `true` for Spotify dev mode (max 5 users, conservative rate limits, longer poll intervals)

## Key Patterns

- **Spotify mutations always use the playlist owner's token** — non-owners get 403 from Spotify
- **Polling** runs via `instrumentation.ts` setInterval (30s default) calling `/api/poll`
- **Dashboard** has Create/Join bottom sheets (not separate pages); `/playlist/new` redirects to `/dashboard`
- **Playlist naming**: `formatPlaylistName()` — initials for <=3 members, group name for >3, suffix "Swapify"
- **No `alert()` calls** — all replaced with `toast.error()` / `toast.info()` (Sonner)
- **Dark-only theme** — shadcn CSS vars mapped directly in `:root` (no `.dark` class toggle)
- **Color palette**: "Arctic Aurora" — `--brand: #38BDF8` (sky blue primary), `--brand-hover: #7DD3FC`, `--accent-green: #4ADE80` (aurora green accent). Tailwind classes: `text-brand`, `bg-brand`, etc. Gradient start: `#081420` (deep navy)
- **Design tokens**: glassmorphism (`glass` class), gradients (`gradient-bg`, `gradient-bg-radial`), `input-glass`, `btn-pill btn-pill-primary/secondary`

## Spotify Dev Mode (`SPOTIFY_DEV_MODE`)

Set `SPOTIFY_DEV_MODE=true` for Spotify apps in development mode (max 5 users). This activates:
- **5-user cap** enforced at OAuth callback (new signups rejected after limit)
- **Global API call budget**: 50 calls/30s (vs 300 in production), tracked in `src/lib/spotify-config.ts`
- **Longer poll interval**: 60s (vs 30s), reduced audit/sync frequencies
- **Stricter per-user rate limits**: search 10/min, mutations 8/min, API 20/min
- **Search limit**: 5 results per query (vs 10)

Config lives in `src/lib/spotify-config.ts`. All values are getters that read `process.env.SPOTIFY_DEV_MODE` at call time.

## Security

- **Rate limiting**: In-memory token-bucket with profiles (api, search, mutation, invite, public) — all dev-mode-aware
- **Spotify API budget**: Rolling 30s window call tracker prevents hitting Spotify's per-app rate limit
- **Token encryption**: AES-256-GCM, backward-compatible with plaintext (no-op if key unset)
- **Security headers**: CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy
- **Session**: iron-session, `sameSite: 'lax'`, `httpOnly: true`, `secure` in production
- **Env validation**: Zod schema with lazy proxy (validates on first property access)
- **Structured logging**: Pino (JSON in production, debug in dev)

## Build & Deploy

```bash
npm run dev           # Local dev server (PGlite)
npm run build         # Production build
npm run start         # Start production server
npm run lint          # ESLint
npm run type-check    # TypeScript check
```

**PGlite build noise**: PGlite emits ENOENT errors during `next build` — these are non-fatal (pages still generate correctly).

**Deployment**: Fly.io with standalone Docker output. Health check at `/api/health`. Set secrets via `fly secrets set DATABASE_URL=...`.

## Remaining Production Tasks

See [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) for full status. Outstanding items:
- Rotate all secrets for production
- Choose Postgres provider (Neon / Supabase / Fly Postgres), provision DB, run migrations
- Rewrite `seed.ts` to use Drizzle ORM (still uses raw better-sqlite3)
- Configure database backups
