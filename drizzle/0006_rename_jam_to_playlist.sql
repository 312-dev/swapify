-- Rename tables: jams -> playlists, jam_members -> playlist_members, jam_tracks -> playlist_tracks
ALTER TABLE `jams` RENAME TO `playlists`;--> statement-breakpoint
ALTER TABLE `jam_members` RENAME TO `playlist_members`;--> statement-breakpoint
ALTER TABLE `jam_tracks` RENAME TO `playlist_tracks`;--> statement-breakpoint

-- Rename jam_id columns to playlist_id
ALTER TABLE `playlist_members` RENAME COLUMN `jam_id` TO `playlist_id`;--> statement-breakpoint
ALTER TABLE `playlist_tracks` RENAME COLUMN `jam_id` TO `playlist_id`;--> statement-breakpoint
ALTER TABLE `track_listens` RENAME COLUMN `jam_id` TO `playlist_id`;--> statement-breakpoint
ALTER TABLE `track_reactions` RENAME COLUMN `jam_id` TO `playlist_id`;--> statement-breakpoint
ALTER TABLE `email_invites` RENAME COLUMN `jam_id` TO `playlist_id`;
