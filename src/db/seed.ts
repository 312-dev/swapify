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

// d.nguyen96 - the playlist owner (avatar fetched below in async seedAllTracks)
insertUser.run(
  ownerUserId,
  'd.nguyen96',
  'D. Nguyen',
  null, // avatar_url — populated async below
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

const seedTracks = [
  {
    uri: 'spotify:track:6guXhXMAHU4QYaEsobnS6v',
    id: '6guXhXMAHU4QYaEsobnS6v',
    name: 'The Unforgiven III',
    artist: 'Metallica',
    album: 'Death Magnetic',
    image: 'https://i.scdn.co/image/ab67616d0000b273dfe44d577f07e08564ec73ed',
    durationMs: 466586,
    addedBy: ownerUserId,
    addedAt: twentyMinAgo,
  },
  {
    uri: 'spotify:track:4u7EnebtmKWzUH433cf5Qv',
    id: '4u7EnebtmKWzUH433cf5Qv',
    name: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    image: 'https://i.scdn.co/image/ab67616d0000b273ce4f1737bc8a646c8c4bd25a',
    durationMs: 354320,
    addedBy: ownerUserId,
    addedAt: fifteenMinAgo,
  },
  {
    uri: 'spotify:track:5CQ30WqJwcep0pYcV4AMNc',
    id: '5CQ30WqJwcep0pYcV4AMNc',
    name: 'Stairway to Heaven',
    artist: 'Led Zeppelin',
    album: 'Led Zeppelin IV',
    image: 'https://i.scdn.co/image/ab67616d0000b2734509204d0860cc0cc67e83dc',
    durationMs: 482830,
    addedBy: ownerUserId,
    addedAt: tenMinAgo,
  },
  {
    uri: 'spotify:track:40riOy7x9W7GXjyGp4pjAv',
    id: '40riOy7x9W7GXjyGp4pjAv',
    name: 'Hotel California',
    artist: 'Eagles',
    album: 'Hotel California',
    image: 'https://i.scdn.co/image/ab67616d0000b2734637341b9f507521afa9a778',
    durationMs: 391376,
    addedBy: ownerUserId,
    addedAt: fiveMinAgo,
  },
  {
    uri: 'spotify:track:7HD1jkMlfB78DOCGmHbKR4',
    id: '7HD1jkMlfB78DOCGmHbKR4',
    name: 'Comfortably Numb',
    artist: 'Pink Floyd',
    album: 'The Wall',
    image: 'https://i.scdn.co/image/ab67616d0000b273f02aa309b0e1b1a9e38e03e7',
    durationMs: 382296,
    addedBy: ownerUserId,
    addedAt: twoMinAgo,
  },
  {
    uri: 'spotify:track:0LN0ASTtcMNRYWfHMgsFSS',
    id: '0LN0ASTtcMNRYWfHMgsFSS',
    name: 'Free Bird',
    artist: 'Lynyrd Skynyrd',
    album: 'Pronounced Leh-Nerd Skin-Nerd',
    image: 'https://i.scdn.co/image/ab67616d0000b273c23400f19a8b0e7ae17cda91',
    durationMs: 548000,
    addedBy: ownerUserId,
    addedAt: now,
  },
];

// ─── Simulate Track Adds (DB + Spotify + Auto-Like) ─────────────────────────

const SPOTIFY_API = 'https://api.spotify.com/v1';
const SPOTIFY_ACCOUNTS = 'https://accounts.spotify.com';
const spotifyPlaylistId = '4ZnPYsKOqPV2qP93VJDzTU';

const insertTrack = sqlite.prepare(`
  INSERT INTO playlist_tracks (id, playlist_id, spotify_track_uri, spotify_track_id, track_name, artist_name, album_name, album_image_url, duration_ms, added_by_user_id, added_at, removed_at, archived_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertReaction = sqlite.prepare(`
  INSERT OR IGNORE INTO track_reactions (id, playlist_id, spotify_track_id, user_id, reaction, is_auto, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

/** Ensure we have a valid access token, refreshing if needed. Returns null if unavailable. */
async function getAccessToken(): Promise<string | null> {
  if (!savedTokens) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (savedTokens.tokenExpiresAt - nowSec >= 300) {
    return savedTokens.accessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    console.log('  Token expired and SPOTIFY_CLIENT_ID not set — skipping Spotify calls.');
    return null;
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
    console.log(`  Token refresh failed (${refreshRes.status}) — skipping Spotify calls.`);
    return null;
  }

  const tokenData = await refreshRes.json();
  savedTokens.accessToken = tokenData.access_token;
  savedTokens.refreshToken = tokenData.refresh_token ?? savedTokens.refreshToken;
  savedTokens.tokenExpiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;

  sqlite
    .prepare(
      'UPDATE users SET access_token = ?, refresh_token = ?, token_expires_at = ? WHERE id = ?'
    )
    .run(savedTokens.accessToken, savedTokens.refreshToken, savedTokens.tokenExpiresAt, myUserId);

  return savedTokens.accessToken;
}

/** Get the set of track URIs already in the Spotify playlist. */
async function getExistingSpotifyUris(accessToken: string): Promise<Set<string>> {
  const existingUris = new Set<string>();
  let url: string | null =
    `${SPOTIFY_API}/playlists/${spotifyPlaylistId}/tracks?limit=50&fields=items(track(uri)),next`;

  while (url) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.log(`  Could not read Spotify playlist (${res.status}).`);
      return existingUris;
    }
    const data = await res.json();
    for (const item of data.items) {
      if (item.track?.uri) existingUris.add(item.track.uri);
    }
    url = data.next;
  }

  return existingUris;
}

/**
 * Simulate adding a single track — mirrors what POST /api/playlists/[id]/tracks does:
 * 1. Insert into DB
 * 2. Add to Spotify playlist (if not already present)
 * 3. Auto-like: check if other members have the track saved in their library
 */
async function addTrack(
  track: (typeof seedTracks)[number],
  accessToken: string | null,
  existingSpotifyUris: Set<string>
): Promise<{ addedToSpotify: boolean; autoLiked: boolean }> {
  const result = { addedToSpotify: false, autoLiked: false };

  // 1. Insert track into DB
  insertTrack.run(
    nanoid(),
    playlistId,
    track.uri,
    track.id,
    track.name,
    track.artist,
    track.album,
    track.image,
    track.durationMs,
    track.addedBy,
    track.addedAt,
    null,
    null
  );

  if (!accessToken) return result;

  // 2. Add to Spotify playlist if missing
  if (!existingSpotifyUris.has(track.uri)) {
    const addRes = await fetch(`${SPOTIFY_API}/playlists/${spotifyPlaylistId}/tracks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: [track.uri] }),
    });
    if (addRes.ok) {
      existingSpotifyUris.add(track.uri);
      result.addedToSpotify = true;
    }
  }

  // 3. Auto-like: check if other members already have this track saved
  //    (mirrors tracks/route.ts POST — check every member except the one who added it)
  const otherMemberIds = [ownerUserId, myUserId].filter((id) => id !== track.addedBy);
  for (const memberId of otherMemberIds) {
    // Only grayson has real tokens — skip members with fake tokens
    if (memberId !== myUserId) continue;

    try {
      const res = await fetch(`${SPOTIFY_API}/me/tracks/contains?ids=${track.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) continue;

      const [isSaved]: boolean[] = await res.json();
      if (isSaved) {
        insertReaction.run(
          nanoid(),
          playlistId,
          track.id,
          memberId,
          'thumbs_up',
          1, // is_auto
          new Date()
        );
        result.autoLiked = true;
      }
    } catch {
      // Token expired or rate limited — skip
    }
  }

  return result;
}

/** Fetch a Spotify user's public profile to get their avatar URL. */
async function fetchSpotifyAvatar(accessToken: string, spotifyId: string): Promise<string | null> {
  try {
    const res = await fetch(`${SPOTIFY_API}/users/${encodeURIComponent(spotifyId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.log(`  Could not fetch profile for ${spotifyId} (${res.status}).`);
      return null;
    }
    const data = await res.json();
    return data.images?.at(-1)?.url ?? null;
  } catch {
    return null;
  }
}

async function seedAllTracks() {
  const accessToken = await getAccessToken();

  // Fetch D. Nguyen's avatar from Spotify if we have tokens
  if (accessToken) {
    const nguynAvatar = await fetchSpotifyAvatar(accessToken, 'd.nguyen96');
    if (nguynAvatar) {
      sqlite.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(nguynAvatar, ownerUserId);
      console.log(`  Fetched avatar for d.nguyen96: ${nguynAvatar}`);
    }
  }

  if (!accessToken) {
    console.log(
      '\n  No valid tokens — inserting tracks into DB only (no Spotify sync or auto-like).'
    );
    for (const track of seedTracks) {
      insertTrack.run(
        nanoid(),
        playlistId,
        track.uri,
        track.id,
        track.name,
        track.artist,
        track.album,
        track.image,
        track.durationMs,
        track.addedBy,
        track.addedAt,
        null,
        null
      );
    }
    return;
  }

  console.log(`\n  Syncing to Spotify playlist ${spotifyPlaylistId}...`);
  const existingSpotifyUris = await getExistingSpotifyUris(accessToken);

  console.log('  Adding tracks one by one (DB + Spotify + auto-like)...');
  let spotifyAdds = 0;
  let autoLikes = 0;

  for (const track of seedTracks) {
    const { addedToSpotify, autoLiked } = await addTrack(track, accessToken, existingSpotifyUris);
    if (addedToSpotify) spotifyAdds++;
    if (autoLiked) autoLikes++;
    const flags = [addedToSpotify ? '+spotify' : '', autoLiked ? '+auto-like' : '']
      .filter(Boolean)
      .join(' ');
    console.log(`    ${track.name}${flags ? ` (${flags})` : ''}`);
  }

  console.log(`  ${spotifyAdds} added to Spotify, ${autoLikes} auto-liked from library.`);
}

seedAllTracks()
  .catch((err) => console.log(`  Seed error: ${err.message}`))
  .finally(() => {
    sqlite.close();
    console.log('\nSeed complete! Restart dev server to pick up changes.');
    console.log(`  Owner (d.nguyen96):  ${ownerUserId}`);
    console.log(`  Member (grayson):    ${myUserId}`);
    console.log(`  Playlist:            ${playlistId}`);
    console.log(`  Invite code:         ${inviteCode}`);
    console.log(`  Tracks: ${seedTracks.length} (all added by d.nguyen96)`);
  });
