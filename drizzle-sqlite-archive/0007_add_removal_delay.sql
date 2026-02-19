ALTER TABLE `playlists` ADD `removal_delay` text DEFAULT 'immediate' NOT NULL;--> statement-breakpoint
ALTER TABLE `playlist_tracks` ADD `completed_at` integer;
