CREATE TABLE `jam_members` (
	`id` text PRIMARY KEY NOT NULL,
	`jam_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`jam_id`) REFERENCES `jams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jam_members_jam_user_idx` ON `jam_members` (`jam_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `jam_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`jam_id` text NOT NULL,
	`spotify_track_uri` text NOT NULL,
	`spotify_track_id` text NOT NULL,
	`track_name` text NOT NULL,
	`artist_name` text NOT NULL,
	`album_name` text,
	`album_image_url` text,
	`duration_ms` integer,
	`added_by_user_id` text NOT NULL,
	`added_at` integer NOT NULL,
	`removed_at` integer,
	FOREIGN KEY (`jam_id`) REFERENCES `jams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jam_tracks_jam_uri_idx` ON `jam_tracks` (`jam_id`,`spotify_track_uri`);--> statement-breakpoint
CREATE TABLE `jams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`image_url` text,
	`spotify_playlist_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`invite_code` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jams_invite_code_unique` ON `jams` (`invite_code`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_sub_user_endpoint_idx` ON `push_subscriptions` (`user_id`,`endpoint`);--> statement-breakpoint
CREATE TABLE `track_listens` (
	`id` text PRIMARY KEY NOT NULL,
	`jam_id` text NOT NULL,
	`spotify_track_id` text NOT NULL,
	`user_id` text NOT NULL,
	`listened_at` integer NOT NULL,
	FOREIGN KEY (`jam_id`) REFERENCES `jams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `track_listens_jam_track_user_idx` ON `track_listens` (`jam_id`,`spotify_track_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `track_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`jam_id` text NOT NULL,
	`spotify_track_id` text NOT NULL,
	`user_id` text NOT NULL,
	`reaction` text NOT NULL,
	`is_auto` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`jam_id`) REFERENCES `jams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `track_reactions_jam_track_user_idx` ON `track_reactions` (`jam_id`,`spotify_track_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`spotify_id` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`email` text,
	`notify_push` integer DEFAULT 1 NOT NULL,
	`notify_email` integer DEFAULT 0 NOT NULL,
	`auto_negative_reactions` integer DEFAULT 1 NOT NULL,
	`recent_emojis` text,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`token_expires_at` integer NOT NULL,
	`last_poll_cursor` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_spotify_id_unique` ON `users` (`spotify_id`);