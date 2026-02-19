-- Migration: Add image_url to circles
ALTER TABLE "circles" ADD COLUMN IF NOT EXISTS "image_url" text;
