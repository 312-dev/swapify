CREATE TABLE "email_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"playlist_id" text NOT NULL,
	"sender_user_id" text NOT NULL,
	"recipient_email" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlist_members" (
	"id" text PRIMARY KEY NOT NULL,
	"playlist_id" text NOT NULL,
	"user_id" text NOT NULL,
	"liked_playlist_id" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlist_tracks" (
	"id" text PRIMARY KEY NOT NULL,
	"playlist_id" text NOT NULL,
	"spotify_track_uri" text NOT NULL,
	"spotify_track_id" text NOT NULL,
	"track_name" text NOT NULL,
	"artist_name" text NOT NULL,
	"album_name" text,
	"album_image_url" text,
	"duration_ms" integer,
	"added_by_user_id" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_url" text,
	"spotify_playlist_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"invite_code" text NOT NULL,
	"archive_playlist_id" text,
	"archive_threshold" text DEFAULT 'none' NOT NULL,
	"max_tracks_per_user" integer,
	"max_track_age_days" integer DEFAULT 7 NOT NULL,
	"removal_delay" text DEFAULT 'immediate' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playlists_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_listens" (
	"id" text PRIMARY KEY NOT NULL,
	"playlist_id" text NOT NULL,
	"spotify_track_id" text NOT NULL,
	"user_id" text NOT NULL,
	"listened_at" timestamp with time zone NOT NULL,
	"listen_duration_ms" integer,
	"was_skipped" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_reactions" (
	"id" text PRIMARY KEY NOT NULL,
	"playlist_id" text NOT NULL,
	"spotify_track_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reaction" text NOT NULL,
	"is_auto" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"spotify_id" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"email" text,
	"pending_email" text,
	"email_verify_token" text,
	"email_verify_expires_at" integer,
	"notify_push" boolean DEFAULT true NOT NULL,
	"notify_email" boolean DEFAULT false NOT NULL,
	"auto_negative_reactions" boolean DEFAULT true NOT NULL,
	"recent_emojis" text,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_expires_at" integer NOT NULL,
	"last_poll_cursor" integer,
	"last_playback_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_spotify_id_unique" UNIQUE("spotify_id")
);
--> statement-breakpoint
ALTER TABLE "email_invites" ADD CONSTRAINT "email_invites_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_invites" ADD CONSTRAINT "email_invites_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_members" ADD CONSTRAINT "playlist_members_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_members" ADD CONSTRAINT "playlist_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_listens" ADD CONSTRAINT "track_listens_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_listens" ADD CONSTRAINT "track_listens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_reactions" ADD CONSTRAINT "track_reactions_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_reactions" ADD CONSTRAINT "track_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_invites_playlist_email_idx" ON "email_invites" USING btree ("playlist_id","recipient_email");--> statement-breakpoint
CREATE UNIQUE INDEX "playlist_members_playlist_user_idx" ON "playlist_members" USING btree ("playlist_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "playlist_tracks_playlist_uri_idx" ON "playlist_tracks" USING btree ("playlist_id","spotify_track_uri");--> statement-breakpoint
CREATE UNIQUE INDEX "push_sub_user_endpoint_idx" ON "push_subscriptions" USING btree ("user_id","endpoint");--> statement-breakpoint
CREATE UNIQUE INDEX "track_listens_playlist_track_user_idx" ON "track_listens" USING btree ("playlist_id","spotify_track_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "track_reactions_playlist_track_user_idx" ON "track_reactions" USING btree ("playlist_id","spotify_track_id","user_id");