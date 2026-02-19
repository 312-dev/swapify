ALTER TABLE `track_listens` ADD `listen_duration_ms` integer;--> statement-breakpoint
ALTER TABLE `track_listens` ADD `was_skipped` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `last_playback_json` text;