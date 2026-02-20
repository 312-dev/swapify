ALTER TABLE "users" ALTER COLUMN "email_verify_expires_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "circle_members" ALTER COLUMN "last_poll_cursor" SET DATA TYPE bigint;