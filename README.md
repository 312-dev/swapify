# Swapify

Collaborative Spotify playlists with reactions — share music with friends through **Swaplists**.

Each member adds tracks, swipes to react (thumbs up / thumbs down), and the playlist syncs back to Spotify. Built as a mobile-first PWA.

## Features

- **Swaplists** — create or join collaborative playlists linked to Spotify
- **Swipe reactions** — swipe right to vibe, swipe left to skip
- **Vibe sort** — reorder tracks by collective reaction score
- **Real-time sync** — tracks stay in sync with the Spotify playlist
- **Push notifications** — get notified when friends add tracks or react
- **Email invites** — invite members by email with verification
- **Installable PWA** — add to home screen, works offline-capable

## Tech Stack

- [Next.js](https://nextjs.org) 16 (App Router, Turbopack)
- TypeScript, Tailwind CSS v4, [shadcn/ui](https://ui.shadcn.com)
- [Motion](https://motion.dev) (Framer Motion v11+) for gestures and animations
- [Drizzle ORM](https://orm.drizzle.team) + SQLite (better-sqlite3)
- Spotify OAuth PKCE (no NextAuth)
- [iron-session](https://github.com/vvo/iron-session) for cookie sessions
- [Resend](https://resend.com) for transactional email
- Web Push (VAPID) for notifications
- Deployed on [Fly.io](https://fly.io) with Docker

## Getting Started

### Prerequisites

- Node.js 20+
- A [Spotify Developer](https://developer.spotify.com/dashboard) app with a redirect URI set to `http://127.0.0.1:3000/api/auth/callback`

### Setup

```bash
# Install dependencies
npm install

# Copy environment template and fill in your values
cp .env.example .env.local

# Initialize the database
npm run db:seed

# Start the dev server
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) to log in with Spotify.

### Environment Variables

See [`.env.example`](.env.example) for all required variables. At minimum you need:

| Variable | Description |
|---|---|
| `SPOTIFY_CLIENT_ID` | From your Spotify Developer app |
| `IRON_SESSION_PASSWORD` | Random string, min 32 characters |

Optional for full functionality: `RESEND_API_KEY` (email invites), `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (push notifications).

Generate VAPID keys with:

```bash
npx web-push generate-vapid-keys
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run type-check` | TypeScript check |
| `npm run db:seed` | Seed database with sample data |

## License

MIT
