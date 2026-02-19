import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { searchTracks } from "@/lib/spotify";

// GET /api/spotify/search?q=...
export async function GET(request: NextRequest) {
  const user = await requireAuth();
  const query = request.nextUrl.searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ tracks: [] });
  }

  const tracks = await searchTracks(user.id, query.trim(), 10);

  return NextResponse.json({
    tracks: tracks.map((t) => ({
      id: t.id,
      uri: t.uri,
      name: t.name,
      duration_ms: t.duration_ms,
      artists: t.artists.map((a) => ({ id: a.id, name: a.name })),
      album: {
        id: t.album.id,
        name: t.album.name,
        images: t.album.images,
      },
      external_urls: t.external_urls,
    })),
  });
}
