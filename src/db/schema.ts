import { pgTable, text, integer, uniqueIndex, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Users ───────────────────────────────────────────────────────────────────
// Profile-only table. Spotify tokens live in circle_members (per-circle).
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  spotifyId: text('spotify_id').notNull().unique(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  email: text('email'),
  pendingEmail: text('pending_email'),
  emailVerifyToken: text('email_verify_token'),
  emailVerifyExpiresAt: integer('email_verify_expires_at'),
  notifyPush: boolean('notify_push').notNull().default(true),
  notifyEmail: boolean('notify_email').notNull().default(false),
  notificationPrefs: text('notification_prefs'), // JSON: per-type channel prefs
  autoNegativeReactions: boolean('auto_negative_reactions').notNull().default(true),
  recentEmojis: text('recent_emojis'), // JSON array of last 3 custom emojis used
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Circles ─────────────────────────────────────────────────────────────────
// A circle groups users under a single Spotify app (client ID).
// Each circle host registers their own Spotify developer app.
export const circles = pgTable(
  'circles',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    imageUrl: text('image_url'),
    spotifyClientId: text('spotify_client_id').notNull(),
    hostUserId: text('host_user_id')
      .notNull()
      .references(() => users.id),
    inviteCode: text('invite_code').notNull().unique(),
    maxMembers: integer('max_members').notNull().default(5),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('circles_host_user_idx').on(table.hostUserId)]
);

// ─── Circle Members ──────────────────────────────────────────────────────────
// Per-user-per-circle Spotify OAuth tokens. Tokens live here (not on users).
export const circleMembers = pgTable(
  'circle_members',
  {
    id: text('id').primaryKey(),
    circleId: text('circle_id')
      .notNull()
      .references(() => circles.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    role: text('role').notNull().default('member'), // 'host' | 'member'
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token').notNull(),
    tokenExpiresAt: integer('token_expires_at').notNull(),
    lastPollCursor: integer('last_poll_cursor'),
    lastPlaybackJson: text('last_playback_json'), // JSON: { trackId, progressMs, durationMs, capturedAt }
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('circle_members_circle_user_idx').on(table.circleId, table.userId)]
);

// ─── Playlists ──────────────────────────────────────────────────────────────
export const playlists = pgTable('playlists', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  spotifyPlaylistId: text('spotify_playlist_id').notNull(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id),
  circleId: text('circle_id')
    .notNull()
    .references(() => circles.id),
  inviteCode: text('invite_code').notNull().unique(),
  archivePlaylistId: text('archive_playlist_id'),
  archiveThreshold: text('archive_threshold').notNull().default('none'),
  maxTracksPerUser: integer('max_tracks_per_user'),
  maxTrackAgeDays: integer('max_track_age_days').notNull().default(7),
  removalDelay: text('removal_delay').notNull().default('immediate'),
  vibeName: text('vibe_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Playlist Members ───────────────────────────────────────────────────────
export const playlistMembers = pgTable(
  'playlist_members',
  {
    id: text('id').primaryKey(),
    playlistId: text('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    likedPlaylistId: text('liked_playlist_id'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('playlist_members_playlist_user_idx').on(table.playlistId, table.userId)]
);

// ─── Playlist Tracks ────────────────────────────────────────────────────────
export const playlistTracks = pgTable(
  'playlist_tracks',
  {
    id: text('id').primaryKey(),
    playlistId: text('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    spotifyTrackUri: text('spotify_track_uri').notNull(),
    spotifyTrackId: text('spotify_track_id').notNull(),
    trackName: text('track_name').notNull(),
    artistName: text('artist_name').notNull(),
    albumName: text('album_name'),
    albumImageUrl: text('album_image_url'),
    durationMs: integer('duration_ms'),
    addedByUserId: text('added_by_user_id')
      .notNull()
      .references(() => users.id),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('playlist_tracks_playlist_uri_idx').on(table.playlistId, table.spotifyTrackUri),
  ]
);

// ─── Track Listens ───────────────────────────────────────────────────────────
export const trackListens = pgTable(
  'track_listens',
  {
    id: text('id').primaryKey(),
    playlistId: text('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    spotifyTrackId: text('spotify_track_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    listenedAt: timestamp('listened_at', { withTimezone: true }).notNull(),
    listenDurationMs: integer('listen_duration_ms'),
    wasSkipped: boolean('was_skipped').notNull().default(false),
  },
  (table) => [
    uniqueIndex('track_listens_playlist_track_user_idx').on(
      table.playlistId,
      table.spotifyTrackId,
      table.userId
    ),
  ]
);

// ─── Track Reactions ─────────────────────────────────────────────────────────
export const trackReactions = pgTable(
  'track_reactions',
  {
    id: text('id').primaryKey(),
    playlistId: text('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    spotifyTrackId: text('spotify_track_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    reaction: text('reaction').notNull(), // "thumbs_up", "thumbs_down", "fire", "heart", etc.
    isAuto: boolean('is_auto').notNull().default(false), // true if auto-generated (save/skip detection)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('track_reactions_playlist_track_user_idx').on(
      table.playlistId,
      table.spotifyTrackId,
      table.userId
    ),
  ]
);

// ─── Email Invites ──────────────────────────────────────────────────────────
export const emailInvites = pgTable(
  'email_invites',
  {
    id: text('id').primaryKey(),
    playlistId: text('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    senderUserId: text('sender_user_id')
      .notNull()
      .references(() => users.id),
    recipientEmail: text('recipient_email').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('email_invites_playlist_email_idx').on(table.playlistId, table.recipientEmail),
  ]
);

// ─── Push Subscriptions ──────────────────────────────────────────────────────
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('push_sub_user_endpoint_idx').on(table.userId, table.endpoint)]
);

// ─── Relations ───────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  ownedPlaylists: many(playlists),
  hostedCircle: many(circles),
  circleMemberships: many(circleMembers),
  memberships: many(playlistMembers),
  addedTracks: many(playlistTracks),
  listens: many(trackListens),
  reactions: many(trackReactions),
  pushSubscriptions: many(pushSubscriptions),
  sentInvites: many(emailInvites),
}));

export const circlesRelations = relations(circles, ({ one, many }) => ({
  host: one(users, { fields: [circles.hostUserId], references: [users.id] }),
  members: many(circleMembers),
  playlists: many(playlists),
}));

export const circleMembersRelations = relations(circleMembers, ({ one }) => ({
  circle: one(circles, { fields: [circleMembers.circleId], references: [circles.id] }),
  user: one(users, { fields: [circleMembers.userId], references: [users.id] }),
}));

export const playlistsRelations = relations(playlists, ({ one, many }) => ({
  owner: one(users, { fields: [playlists.ownerId], references: [users.id] }),
  circle: one(circles, { fields: [playlists.circleId], references: [circles.id] }),
  members: many(playlistMembers),
  tracks: many(playlistTracks),
  emailInvites: many(emailInvites),
}));

export const playlistMembersRelations = relations(playlistMembers, ({ one }) => ({
  playlist: one(playlists, { fields: [playlistMembers.playlistId], references: [playlists.id] }),
  user: one(users, { fields: [playlistMembers.userId], references: [users.id] }),
}));

export const playlistTracksRelations = relations(playlistTracks, ({ one }) => ({
  playlist: one(playlists, { fields: [playlistTracks.playlistId], references: [playlists.id] }),
  addedBy: one(users, {
    fields: [playlistTracks.addedByUserId],
    references: [users.id],
  }),
}));

export const trackReactionsRelations = relations(trackReactions, ({ one }) => ({
  playlist: one(playlists, { fields: [trackReactions.playlistId], references: [playlists.id] }),
  user: one(users, { fields: [trackReactions.userId], references: [users.id] }),
}));

export const trackListensRelations = relations(trackListens, ({ one }) => ({
  playlist: one(playlists, { fields: [trackListens.playlistId], references: [playlists.id] }),
  user: one(users, { fields: [trackListens.userId], references: [users.id] }),
}));

export const emailInvitesRelations = relations(emailInvites, ({ one }) => ({
  playlist: one(playlists, { fields: [emailInvites.playlistId], references: [playlists.id] }),
  sender: one(users, {
    fields: [emailInvites.senderUserId],
    references: [users.id],
  }),
}));

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}));
