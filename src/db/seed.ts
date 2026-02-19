import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'swapify.db');

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

// Try to preserve grayson's real Spotify tokens before wiping
let savedTokens: { accessToken: string; refreshToken: string; tokenExpiresAt: number } | null =
  null;
try {
  const row = sqlite
    .prepare('SELECT access_token, refresh_token, token_expires_at FROM users WHERE spotify_id = ?')
    .get('grayson.adams') as
    | { access_token: string; refresh_token: string; token_expires_at: number }
    | undefined;
  if (row && row.refresh_token && !row.refresh_token.startsWith('placeholder')) {
    savedTokens = {
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      tokenExpiresAt: row.token_expires_at,
    };
    console.log("  Preserved grayson's Spotify tokens from previous session.");
  }
} catch {
  // Table might not exist on first run
}

// Drop all tables and recreate (keeps the file handle valid for running dev server)
sqlite.pragma('foreign_keys = OFF');

const tables = sqlite
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
  .all() as { name: string }[];
for (const { name } of tables) {
  sqlite.exec(`DROP TABLE IF EXISTS "${name}"`);
}

// Run migrations to create tables
const migrationsDir = path.join(process.cwd(), 'drizzle');
const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

for (const file of migrationFiles) {
  const raw = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
  const statements = raw
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    sqlite.exec(stmt);
  }
}

sqlite.pragma('foreign_keys = ON');

// ─── Seed Data ──────────────────────────────────────────────────────────────

const now = Math.floor(Date.now() / 1000);
const oneHourAgo = now - 3600;
const thirtyMinAgo = now - 1800;
const twentyMinAgo = now - 1200;
const fifteenMinAgo = now - 900;
const tenMinAgo = now - 600;
const fiveMinAgo = now - 300;
const twoMinAgo = now - 120;

// ─── Users ──────────────────────────────────────────────────────────────────

const ownerUserId = nanoid();
const myUserId = nanoid();

const insertUser = sqlite.prepare(`
  INSERT INTO users (id, spotify_id, display_name, avatar_url, email, notify_push, notify_email, auto_negative_reactions, recent_emojis, access_token, refresh_token, token_expires_at, last_poll_cursor, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// d.nguyen96 - the playlist owner
insertUser.run(
  ownerUserId,
  'd.nguyen96',
  'D. Nguyen',
  null,
  null,
  1, // notify_push
  0, // notify_email
  1, // auto_negative_reactions
  null, // recent_emojis
  'fake-access-token-nguyen',
  'fake-refresh-token-nguyen',
  now + 3600, // token_expires_at (1 hour from now)
  null, // last_poll_cursor
  oneHourAgo // created_at
);

// grayson.adams - me, joined the playlist
insertUser.run(
  myUserId,
  'grayson.adams',
  'Grayson Adams',
  'https://i.scdn.co/image/ab6775700000ee85fca0a1959a56161094daefbb',
  null,
  1, // notify_push
  0, // notify_email
  1, // auto_negative_reactions
  null, // recent_emojis
  'placeholder-access-token',
  'placeholder-refresh-token',
  now + 3600, // token_expires_at
  null, // last_poll_cursor
  thirtyMinAgo // created_at
);

// Restore grayson's real tokens if we saved them
if (savedTokens) {
  sqlite
    .prepare(
      'UPDATE users SET access_token = ?, refresh_token = ?, token_expires_at = ? WHERE id = ?'
    )
    .run(savedTokens.accessToken, savedTokens.refreshToken, savedTokens.tokenExpiresAt, myUserId);
}

// ─── Playlist ───────────────────────────────────────────────────────────────

const playlistId = nanoid();
const inviteCode = nanoid(8);

sqlite
  .prepare(
    `INSERT INTO playlists (id, name, description, image_url, spotify_playlist_id, owner_id, invite_code, archive_playlist_id, archive_threshold, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  .run(
    playlistId,
    'Test Name',
    '',
    '',
    '4ZnPYsKOqPV2qP93VJDzTU',
    ownerUserId, // d.nguyen96 owns this playlist
    inviteCode,
    null,
    'none',
    oneHourAgo
  );

// ─── Playlist Members ──────────────────────────────────────────────────────

const insertMember = sqlite.prepare(`
  INSERT INTO playlist_members (id, playlist_id, user_id, joined_at) VALUES (?, ?, ?, ?)
`);

// Owner is a member
insertMember.run(nanoid(), playlistId, ownerUserId, oneHourAgo);

// Grayson joined later
insertMember.run(nanoid(), playlistId, myUserId, thirtyMinAgo);

// ─── Playlist Tracks ───────────────────────────────────────────────────────

const insertTrack = sqlite.prepare(`
  INSERT INTO playlist_tracks (id, playlist_id, spotify_track_uri, spotify_track_id, track_name, artist_name, album_name, album_image_url, duration_ms, added_by_user_id, added_at, removed_at, archived_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Track 1: The Unforgiven III by Metallica - added by d.nguyen96
insertTrack.run(
  nanoid(),
  playlistId,
  'spotify:track:6guXhXMAHU4QYaEsobnS6v',
  '6guXhXMAHU4QYaEsobnS6v',
  'The Unforgiven III',
  'Metallica',
  'Death Magnetic',
  'https://i.scdn.co/image/ab67616d0000b273dfe44d577f07e08564ec73ed',
  466586,
  ownerUserId,
  twentyMinAgo,
  null,
  null
);

// Track 2: Bohemian Rhapsody - added by d.nguyen96
insertTrack.run(
  nanoid(),
  playlistId,
  'spotify:track:4u7EnebtmKWzUH433cf5Qv',
  '4u7EnebtmKWzUH433cf5Qv',
  'Bohemian Rhapsody',
  'Queen',
  'A Night at the Opera',
  'https://i.scdn.co/image/ab67616d0000b273ce4f1737bc8a646c8c4bd25a',
  354320,
  ownerUserId,
  fifteenMinAgo,
  null,
  null
);

// Track 3: Stairway to Heaven - added by d.nguyen96
insertTrack.run(
  nanoid(),
  playlistId,
  'spotify:track:5CQ30WqJwcep0pYcV4AMNc',
  '5CQ30WqJwcep0pYcV4AMNc',
  'Stairway to Heaven',
  'Led Zeppelin',
  'Led Zeppelin IV',
  'https://i.scdn.co/image/ab67616d0000b2734509204d0860cc0cc67e83dc',
  482830,
  ownerUserId,
  tenMinAgo,
  null,
  null
);

// Track 4: Hotel California - added by d.nguyen96
insertTrack.run(
  nanoid(),
  playlistId,
  'spotify:track:40riOy7x9W7GXjyGp4pjAv',
  '40riOy7x9W7GXjyGp4pjAv',
  'Hotel California',
  'Eagles',
  'Hotel California',
  'https://i.scdn.co/image/ab67616d0000b2734637341b9f507521afa9a778',
  391376,
  ownerUserId,
  fiveMinAgo,
  null,
  null
);

// Track 5: Comfortably Numb - added by d.nguyen96
insertTrack.run(
  nanoid(),
  playlistId,
  'spotify:track:7HD1jkMlfB78DOCGmHbKR4',
  '7HD1jkMlfB78DOCGmHbKR4',
  'Comfortably Numb',
  'Pink Floyd',
  'The Wall',
  'https://i.scdn.co/image/ab67616d0000b273f02aa309b0e1b1a9e38e03e7',
  382296,
  ownerUserId,
  twoMinAgo,
  null,
  null
);

// Track 6: Free Bird - added by d.nguyen96
insertTrack.run(
  nanoid(),
  playlistId,
  'spotify:track:0LN0ASTtcMNRYWfHMgsFSS',
  '0LN0ASTtcMNRYWfHMgsFSS',
  'Free Bird',
  'Lynyrd Skynyrd',
  'Pronounced Leh-Nerd Skin-Nerd',
  'https://i.scdn.co/image/ab67616d0000b273c23400f19a8b0e7ae17cda91',
  548000,
  ownerUserId,
  now, // most recent
  null,
  null
);

// ─── Spotify Playlist Sync ──────────────────────────────────────────────────

const SPOTIFY_API = 'https://api.spotify.com/v1';
const SPOTIFY_ACCOUNTS = 'https://accounts.spotify.com';
const spotifyPlaylistId = '4ZnPYsKOqPV2qP93VJDzTU';

const seededTrackUris = [
  'spotify:track:6guXhXMAHU4QYaEsobnS6v',
  'spotify:track:4u7EnebtmKWzUH433cf5Qv',
  'spotify:track:5CQ30WqJwcep0pYcV4AMNc',
  'spotify:track:40riOy7x9W7GXjyGp4pjAv',
  'spotify:track:7HD1jkMlfB78DOCGmHbKR4',
  'spotify:track:0LN0ASTtcMNRYWfHMgsFSS',
];

async function syncTracksToSpotify() {
  if (!savedTokens) {
    console.log('\n  Spotify sync skipped — no saved tokens. Log in and re-run seed to sync.');
    return;
  }

  let accessToken = savedTokens.accessToken;
  const clientId = process.env.SPOTIFY_CLIENT_ID;

  // Refresh the token if it's expired or close to expiring
  const nowSec = Math.floor(Date.now() / 1000);
  if (savedTokens.tokenExpiresAt - nowSec < 300) {
    if (!clientId) {
      console.log('\n  Spotify sync skipped — SPOTIFY_CLIENT_ID not set and token expired.');
      return;
    }
    console.log('  Refreshing expired token...');
    const refreshRes = await fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: savedTokens.refreshToken,
        client_id: clientId,
      }),
    });
    if (!refreshRes.ok) {
      console.log(`\n  Spotify sync skipped — token refresh failed (${refreshRes.status}).`);
      return;
    }
    const tokenData = await refreshRes.json();
    accessToken = tokenData.access_token;
    // Update the DB with the fresh token
    sqlite
      .prepare(
        'UPDATE users SET access_token = ?, refresh_token = ?, token_expires_at = ? WHERE id = ?'
      )
      .run(
        accessToken,
        tokenData.refresh_token ?? savedTokens.refreshToken,
        Math.floor(Date.now() / 1000) + tokenData.expires_in,
        myUserId
      );
  }

  // Fetch existing playlist tracks
  console.log(`\n  Syncing tracks to Spotify playlist ${spotifyPlaylistId}...`);
  const existingUris = new Set<string>();
  let url: string | null =
    `${SPOTIFY_API}/playlists/${spotifyPlaylistId}/tracks?limit=50&fields=items(track(uri)),next`;

  while (url) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.log(`  Spotify sync failed — could not read playlist (${res.status}).`);
      return;
    }
    const data = await res.json();
    for (const item of data.items) {
      if (item.track?.uri) existingUris.add(item.track.uri);
    }
    url = data.next;
  }

  const missingUris = seededTrackUris.filter((uri) => !existingUris.has(uri));

  if (missingUris.length === 0) {
    console.log('  All seeded tracks already in Spotify playlist.');
    return;
  }

  // Add missing tracks
  const addRes = await fetch(`${SPOTIFY_API}/playlists/${spotifyPlaylistId}/tracks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uris: missingUris }),
  });

  if (addRes.ok) {
    console.log(`  Added ${missingUris.length} track(s) to Spotify playlist.`);
  } else {
    console.log(`  Spotify sync failed — could not add tracks (${addRes.status}).`);
  }
}

syncTracksToSpotify()
  .catch((err) => console.log(`  Spotify sync error: ${err.message}`))
  .finally(() => {
    sqlite.close();
    console.log('\nSeed complete! Restart dev server to pick up changes.');
    console.log(`  Owner (d.nguyen96):  ${ownerUserId}`);
    console.log(`  Member (grayson):    ${myUserId}`);
    console.log(`  Playlist:            ${playlistId}`);
    console.log(`  Invite code:         ${inviteCode}`);
    console.log('  Tracks: 6 (all added by d.nguyen96)');
  });
