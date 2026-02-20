CREATE TABLE IF NOT EXISTS "circle_invites" (
  "id" text PRIMARY KEY NOT NULL,
  "circle_id" text NOT NULL REFERENCES "circles"("id") ON DELETE CASCADE,
  "sender_user_id" text NOT NULL REFERENCES "users"("id"),
  "recipient_email" text NOT NULL,
  "invite_token" text NOT NULL UNIQUE,
  "expires_at" bigint NOT NULL,
  "used_at" timestamp with time zone,
  "used_by_user_id" text REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
