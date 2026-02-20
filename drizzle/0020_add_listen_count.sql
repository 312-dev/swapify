-- Ensure track_listens table exists (may be missing if initial migration was partial)
CREATE TABLE IF NOT EXISTS "track_listens" (
	"id" text PRIMARY KEY NOT NULL,
	"playlist_id" text NOT NULL,
	"spotify_track_id" text NOT NULL,
	"user_id" text NOT NULL,
	"listened_at" timestamp with time zone NOT NULL,
	"listen_duration_ms" integer,
	"was_skipped" boolean DEFAULT false NOT NULL,
	"listen_count" integer NOT NULL DEFAULT 1
);--> statement-breakpoint
-- Add FK constraints if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'track_listens_playlist_id_playlists_id_fk') THEN
    ALTER TABLE "track_listens" ADD CONSTRAINT "track_listens_playlist_id_playlists_id_fk"
      FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'track_listens_user_id_users_id_fk') THEN
    ALTER TABLE "track_listens" ADD CONSTRAINT "track_listens_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
-- Add unique index if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS "track_listens_playlist_track_user_idx" ON "track_listens" USING btree ("playlist_id","spotify_track_id","user_id");--> statement-breakpoint
-- Add listen_count column if table existed without it
DO $$ BEGIN
  ALTER TABLE "track_listens" ADD COLUMN "listen_count" integer NOT NULL DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
