ALTER TABLE `jam_tracks` ADD `archived_at` integer;--> statement-breakpoint
ALTER TABLE `jams` ADD `archive_playlist_id` text;--> statement-breakpoint
ALTER TABLE `jams` ADD `archive_threshold` text DEFAULT 'none' NOT NULL;