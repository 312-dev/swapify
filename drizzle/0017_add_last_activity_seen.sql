ALTER TABLE "playlist_members" ADD COLUMN "last_activity_seen_at" timestamp with time zone;--> statement-breakpoint
UPDATE "playlist_members" SET "last_activity_seen_at" = "joined_at";
