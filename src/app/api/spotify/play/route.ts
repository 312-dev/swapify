import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { startPlayback } from "@/lib/spotify";

export async function PUT(request: NextRequest) {
  const user = await requireAuth();

  const { trackUri, contextUri } = await request.json();
  if (!trackUri || !contextUri) {
    return NextResponse.json(
      { error: "trackUri and contextUri are required" },
      { status: 400 }
    );
  }

  const res = await startPlayback(user.id, { contextUri, trackUri });

  if (res.status === 204 || res.ok) {
    return NextResponse.json({ ok: true });
  }

  if (res.status === 404) {
    return NextResponse.json(
      { error: "No active Spotify device found. Open Spotify on a device first." },
      { status: 404 }
    );
  }

  if (res.status === 403) {
    return NextResponse.json(
      { error: "Spotify Premium is required for playback control." },
      { status: 403 }
    );
  }

  const text = await res.text().catch(() => "");
  return NextResponse.json(
    { error: text || "Failed to start playback." },
    { status: res.status }
  );
}
