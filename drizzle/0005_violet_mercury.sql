ALTER TABLE `users` ADD `pending_email` text;--> statement-breakpoint
ALTER TABLE `users` ADD `email_verify_token` text;--> statement-breakpoint
ALTER TABLE `users` ADD `email_verify_expires_at` integer;