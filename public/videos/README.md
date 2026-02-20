# Hero Background Videos

Looping background clips for the landing page hero section. On each page load, 3 random clips are selected and crossfaded every 5 seconds, each starting at a random timestamp.

## Format Standard

| Property     | Requirement                              |
| ------------ | ---------------------------------------- |
| Format       | MP4 (H.264)                              |
| Resolution   | 720p (1280x720) max                      |
| Audio        | None (strip with `-an`)                  |
| Duration     | 8s minimum (5s display + crossfade room) |
| File size    | ~0.5-1.5 MB per clip                     |
| Filename     | `hero-{N}.mp4` (sequential numbering)    |
| Faststart    | Required (`-movflags +faststart`)        |

## Adding a New Video

1. **Download** the source clip (Pexels, Pixabay, Coverr, etc. - must be royalty-free / CC0).

2. **Compress** with ffmpeg:

   ```bash
   ffmpeg -i source.mp4 \
     -vf "scale=-2:720" \
     -c:v libx264 -crf 32 -preset fast \
     -an -movflags +faststart \
     public/videos/hero-{N}.mp4
   ```

   - `-vf "scale=-2:720"` — downscale to 720p (keeps aspect ratio)
   - `-crf 32` — aggressive compression (fine at 45% opacity behind a dark overlay)
   - `-an` — strip audio (videos are always muted)
   - `-movflags +faststart` — moves metadata to file start for instant playback

3. **Register** the clip in `src/app/LandingClient.tsx`:

   ```ts
   const ALL_HERO_VIDEOS = [
     '/videos/hero-1.mp4',
     '/videos/hero-2.mp4',
     // ... add your new entry here
   ];
   ```

4. **Verify** the file is under ~1.5 MB and at least 8 seconds long.

## Current Inventory

| File      | Source (Pexels ID) | Description                       |
| --------- | ------------------ | --------------------------------- |
| hero-1    | 8955635            | Music production / studio         |
| hero-2    | 5664481            | Woman dancing with vacuum          |
| hero-3    | 7253206            | Man listening, drinking coffee     |
| hero-4    | 6638392            | Woman wearing headphones           |
| hero-5    | 7429310            | Man packing with music             |
| hero-6    | 33261219           | Abstract / music visual            |
| hero-7    | 4835144            | Young man chilling to music        |
| hero-8    | 6686341            | Woman listening on bus              |
| hero-9    | 6700182            | Man with wireless headphones lying |
| hero-10   | 10598576           | Music / lifestyle                  |
| hero-11   | 5118415            | Man listening to music             |

## Git

These files are in `.gitignore` (too large for git). They live only in the deploy image and local dev. Back up separately if needed.
