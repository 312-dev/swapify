import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  spotifyId: text("spotify_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  email: text("email"),
  pendingEmail: text("pending_email"),
  emailVerifyToken: text("email_verify_token"),
  emailVerifyExpiresAt: integer("email_verify_expires_at"),
  notifyPush: integer("notify_push").notNull().default(1),
  notifyEmail: integer("notify_email").notNull().default(0),
  autoNegativeReactions: integer("auto_negative_reactions").notNull().default(1),
  recentEmojis: text("recent_emojis"), // JSON array of last 3 custom emojis used
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiresAt: integer("token_expires_at").notNull(),
  lastPollCursor: integer("last_poll_cursor"),
  lastPlaybackJson: text("last_playback_json"), // JSON: { trackId, progressMs, durationMs, capturedAt }
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Jams ────────────────────────────────────────────────────────────────────
export const jams = sqliteTable("jams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  spotifyPlaylistId: text("spotify_playlist_id").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  inviteCode: text("invite_code").notNull().unique(),
  archivePlaylistId: text("archive_playlist_id"),
  archiveThreshold: text("archive_threshold").notNull().default("none"),
  maxTracksPerUser: integer("max_tracks_per_user"),
  maxTrackAgeDays: integer("max_track_age_days").notNull().default(7),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Jam Members ─────────────────────────────────────────────────────────────
export const jamMembers = sqliteTable(
  "jam_members",
  {
    id: text("id").primaryKey(),
    jamId: text("jam_id")
      .notNull()
      .references(() => jams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    joinedAt: integer("joined_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("jam_members_jam_user_idx").on(table.jamId, table.userId),
  ]
);

// ─── Jam Tracks ──────────────────────────────────────────────────────────────
export const jamTracks = sqliteTable(
  "jam_tracks",
  {
    id: text("id").primaryKey(),
    jamId: text("jam_id")
      .notNull()
      .references(() => jams.id, { onDelete: "cascade" }),
    spotifyTrackUri: text("spotify_track_uri").notNull(),
    spotifyTrackId: text("spotify_track_id").notNull(),
    trackName: text("track_name").notNull(),
    artistName: text("artist_name").notNull(),
    albumName: text("album_name"),
    albumImageUrl: text("album_image_url"),
    durationMs: integer("duration_ms"),
    addedByUserId: text("added_by_user_id")
      .notNull()
      .references(() => users.id),
    addedAt: integer("added_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    removedAt: integer("removed_at", { mode: "timestamp" }),
    archivedAt: integer("archived_at", { mode: "timestamp" }),
  },
  (table) => [
    uniqueIndex("jam_tracks_jam_uri_idx").on(
      table.jamId,
      table.spotifyTrackUri
    ),
  ]
);

// ─── Track Listens ───────────────────────────────────────────────────────────
export const trackListens = sqliteTable(
  "track_listens",
  {
    id: text("id").primaryKey(),
    jamId: text("jam_id")
      .notNull()
      .references(() => jams.id, { onDelete: "cascade" }),
    spotifyTrackId: text("spotify_track_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    listenedAt: integer("listened_at", { mode: "timestamp" }).notNull(),
    listenDurationMs: integer("listen_duration_ms"),
    wasSkipped: integer("was_skipped").notNull().default(0),
  },
  (table) => [
    uniqueIndex("track_listens_jam_track_user_idx").on(
      table.jamId,
      table.spotifyTrackId,
      table.userId
    ),
  ]
);

// ─── Track Reactions ─────────────────────────────────────────────────────────
export const trackReactions = sqliteTable(
  "track_reactions",
  {
    id: text("id").primaryKey(),
    jamId: text("jam_id")
      .notNull()
      .references(() => jams.id, { onDelete: "cascade" }),
    spotifyTrackId: text("spotify_track_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    reaction: text("reaction").notNull(), // "thumbs_up", "thumbs_down", "fire", "heart", etc.
    isAuto: integer("is_auto").notNull().default(0), // 1 if auto-generated (save/skip detection)
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("track_reactions_jam_track_user_idx").on(
      table.jamId,
      table.spotifyTrackId,
      table.userId
    ),
  ]
);

// ─── Email Invites ──────────────────────────────────────────────────────────
export const emailInvites = sqliteTable(
  "email_invites",
  {
    id: text("id").primaryKey(),
    jamId: text("jam_id")
      .notNull()
      .references(() => jams.id, { onDelete: "cascade" }),
    senderUserId: text("sender_user_id")
      .notNull()
      .references(() => users.id),
    recipientEmail: text("recipient_email").notNull(),
    sentAt: integer("sent_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("email_invites_jam_email_idx").on(
      table.jamId,
      table.recipientEmail
    ),
  ]
);

// ─── Push Subscriptions ──────────────────────────────────────────────────────
export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("push_sub_user_endpoint_idx").on(table.userId, table.endpoint),
  ]
);

// ─── Relations ───────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  ownedJams: many(jams),
  memberships: many(jamMembers),
  addedTracks: many(jamTracks),
  listens: many(trackListens),
  reactions: many(trackReactions),
  pushSubscriptions: many(pushSubscriptions),
  sentInvites: many(emailInvites),
}));

export const jamsRelations = relations(jams, ({ one, many }) => ({
  owner: one(users, { fields: [jams.ownerId], references: [users.id] }),
  members: many(jamMembers),
  tracks: many(jamTracks),
  emailInvites: many(emailInvites),
}));

export const jamMembersRelations = relations(jamMembers, ({ one }) => ({
  jam: one(jams, { fields: [jamMembers.jamId], references: [jams.id] }),
  user: one(users, { fields: [jamMembers.userId], references: [users.id] }),
}));

export const jamTracksRelations = relations(jamTracks, ({ one }) => ({
  jam: one(jams, { fields: [jamTracks.jamId], references: [jams.id] }),
  addedBy: one(users, {
    fields: [jamTracks.addedByUserId],
    references: [users.id],
  }),
}));

export const trackReactionsRelations = relations(trackReactions, ({ one }) => ({
  jam: one(jams, { fields: [trackReactions.jamId], references: [jams.id] }),
  user: one(users, { fields: [trackReactions.userId], references: [users.id] }),
}));

export const trackListensRelations = relations(trackListens, ({ one }) => ({
  jam: one(jams, { fields: [trackListens.jamId], references: [jams.id] }),
  user: one(users, { fields: [trackListens.userId], references: [users.id] }),
}));

export const emailInvitesRelations = relations(emailInvites, ({ one }) => ({
  jam: one(jams, { fields: [emailInvites.jamId], references: [jams.id] }),
  sender: one(users, {
    fields: [emailInvites.senderUserId],
    references: [users.id],
  }),
}));

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [pushSubscriptions.userId],
      references: [users.id],
    }),
  })
);
