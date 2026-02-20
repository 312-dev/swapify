DO $$ BEGIN
  ALTER TABLE "playlists" ADD COLUMN "auto_reactions_enabled" boolean NOT NULL DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
