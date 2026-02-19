-- Migration: Add Circles architecture
-- Circles group users under a single Spotify app (client ID).
-- Tokens move from users table to circle_members (per-user-per-circle).

-- 1. Create circles table
CREATE TABLE IF NOT EXISTS "circles" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "spotify_client_id" text NOT NULL,
  "host_user_id" text NOT NULL REFERENCES "users"("id"),
  "invite_code" text NOT NULL UNIQUE,
  "max_members" integer NOT NULL DEFAULT 5,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "circles_host_user_idx" ON "circles" ("host_user_id");

--> statement-breakpoint

-- 2. Create circle_members table (tokens live here now)
CREATE TABLE IF NOT EXISTS "circle_members" (
  "id" text PRIMARY KEY NOT NULL,
  "circle_id" text NOT NULL REFERENCES "circles"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "role" text NOT NULL DEFAULT 'member',
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "token_expires_at" integer NOT NULL,
  "last_poll_cursor" integer,
  "last_playback_json" text,
  "joined_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "circle_members_circle_user_idx" ON "circle_members" ("circle_id", "user_id");

--> statement-breakpoint

-- 3. Add circle_id to playlists (nullable first for data migration)
ALTER TABLE "playlists" ADD COLUMN IF NOT EXISTS "circle_id" text REFERENCES "circles"("id");

--> statement-breakpoint

-- 4. Migrate existing data: create a circle per user who has tokens, move their tokens
-- Generate circle IDs and invite codes from existing user data
INSERT INTO "circles" ("id", "name", "spotify_client_id", "host_user_id", "invite_code", "max_members", "created_at")
SELECT
  'cir_' || "id",
  "display_name" || '''s Circle',
  COALESCE("spotify_client_id", 'unknown'),
  "id",
  substr(md5(random()::text), 1, 8),
  5,
  "created_at"
FROM "users"
WHERE "access_token" IS NOT NULL AND "access_token" != ''
ON CONFLICT DO NOTHING;

--> statement-breakpoint

-- Move tokens to circle_members
INSERT INTO "circle_members" ("id", "circle_id", "user_id", "role", "access_token", "refresh_token", "token_expires_at", "last_poll_cursor", "last_playback_json", "joined_at")
SELECT
  'cm_' || "id",
  'cir_' || "id",
  "id",
  'host',
  "access_token",
  "refresh_token",
  "token_expires_at",
  "last_poll_cursor",
  "last_playback_json",
  "created_at"
FROM "users"
WHERE "access_token" IS NOT NULL AND "access_token" != ''
ON CONFLICT DO NOTHING;

--> statement-breakpoint

-- Backfill circle_id on playlists from owner's circle
UPDATE "playlists" SET "circle_id" = 'cir_' || "owner_id"
WHERE "circle_id" IS NULL
AND EXISTS (SELECT 1 FROM "circles" WHERE "circles"."id" = 'cir_' || "playlists"."owner_id");

--> statement-breakpoint

-- 5. Make circle_id NOT NULL (after data migration)
ALTER TABLE "playlists" ALTER COLUMN "circle_id" SET NOT NULL;

--> statement-breakpoint

-- 6. Drop old token columns from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "access_token";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "refresh_token";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "token_expires_at";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "spotify_client_id";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "last_poll_cursor";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "last_playback_json";
