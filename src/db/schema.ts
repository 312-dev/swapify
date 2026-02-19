import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  spotifyId: text('spotify_id').notNull().unique(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  email: text('email'),
  pendingEmail: text('pending_email'),
  emailVerifyToken: text('email_verify_token'),
  emailVerifyExpiresAt: integer('email_verify_expires_at'),
  notifyPush: integer('notify_push').notNull().default(1),
  notifyEmail: integer('notify_email').notNull().default(0),
  autoNegativeReactions: integer('auto_negative_reactions').notNull().default(1),
  recentEmojis: text('recent_emojis'), // JSON array of last 3 custom emojis used
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  tokenExpiresAt: integer('token_expires_at').notNull(),
  lastPollCursor: integer('last_poll_cursor'),
  lastPlaybackJson: text('last_playback_json'), // JSON: { trackId, progressMs, durationMs, capturedAt }
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Playlists ──────────────────────────────────────────────────────────────
export const playlists = sqliteTable('playlists', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  spotifyPlaylistId: text('spotify_playlist_id').notNull(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id),
  inviteCode: text('invite_code').notNull().unique(),
  archivePlaylistId: text('archive_playlist_id'),
  archiveThreshold: text('archive_threshold').notNull().default('none'),
  maxTracksPerUser: integer('max_tracks_per_user'),
  maxTrackAgeDays: integer('max_track_age_days').notNull().default(7),
  removalDelay: text('removal_delay').notNull().default('immediate'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Playlist Members ───────────────────────────────────────────────────────
export const playlistMembers = sqliteTable(
  'playlist_members',
  {
    id: text('id').primaryKey(),
    playlistId: text('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    joinedAt: integer('joined_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex('playlist_members_playlist_user_idx').on(table.playlistId, table.userId)]
);

// ─── Playlist Tracks ────────────────────────────────────────────────────────
export const playlistTracks = sqliteTable(
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
    addedAt: integer('added_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    removedAt: integer('removed_at', { mode: 'timestamp' }),
    archivedAt: integer('archived_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
  },
  (table) => [
    uniqueIndex('playlist_tracks_playlist_uri_idx').on(table.playlistId, table.spotifyTrackUri),
  ]
);

// ─── Track Listens ───────────────────────────────────────────────────────────
export const trackListens = sqliteTable(
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
    listenedAt: integer('listened_at', { mode: 'timestamp' }).notNull(),
    listenDurationMs: integer('listen_duration_ms'),
    wasSkipped: integer('was_skipped').notNull().default(0),
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
export const trackReactions = sqliteTable(
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
    isAuto: integer('is_auto').notNull().default(0), // 1 if auto-generated (save/skip detection)
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
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
export const emailInvites = sqliteTable(
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
    sentAt: integer('sent_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex('email_invites_playlist_email_idx').on(table.playlistId, table.recipientEmail),
  ]
);

// ─── Push Subscriptions ──────────────────────────────────────────────────────
export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex('push_sub_user_endpoint_idx').on(table.userId, table.endpoint)]
);

// ─── Relations ───────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  ownedPlaylists: many(playlists),
  memberships: many(playlistMembers),
  addedTracks: many(playlistTracks),
  listens: many(trackListens),
  reactions: many(trackReactions),
  pushSubscriptions: many(pushSubscriptions),
  sentInvites: many(emailInvites),
}));

export const playlistsRelations = relations(playlists, ({ one, many }) => ({
  owner: one(users, { fields: [playlists.ownerId], references: [users.id] }),
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
