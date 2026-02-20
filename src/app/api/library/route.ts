import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSession } from '@/lib/auth';
import {
  checkSavedTracks,
  saveTracks,
  removeSavedTracks,
  SpotifyRateLimitError,
} from '@/lib/spotify';

// GET /api/library?ids=id1,id2,... — check which tracks are in user's library
export async function GET(request: NextRequest) {
  const user = await requireAuth();
  const session = await getSession();
  const circleId = session.activeCircleId;
  if (!circleId) {
    return NextResponse.json({ error: 'No active circle' }, { status: 400 });
  }

  const ids = request.nextUrl.searchParams.get('ids');
  if (!ids) {
    return NextResponse.json({ error: 'Missing ids parameter' }, { status: 400 });
  }

  const trackIds = ids.split(',').filter(Boolean);
  if (trackIds.length === 0 || trackIds.length > 50) {
    return NextResponse.json({ error: 'Provide 1-50 track IDs' }, { status: 400 });
  }

  try {
    const saved = await checkSavedTracks(user.id, circleId, trackIds);
    const result: Record<string, boolean> = {};
    trackIds.forEach((id, i) => {
      result[id] = saved[i] ?? false;
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SpotifyRateLimitError) {
      return NextResponse.json(
        {
          error: 'Spotify is a bit busy right now. Please try again in a minute.',
          rateLimited: true,
        },
        { status: 429 }
      );
    }
    throw err;
  }
}

// PUT /api/library — save tracks to user's library
export async function PUT(request: NextRequest) {
  const user = await requireAuth();
  const session = await getSession();
  const circleId = session.activeCircleId;
  if (!circleId) {
    return NextResponse.json({ error: 'No active circle' }, { status: 400 });
  }

  const { ids } = await request.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Missing ids array' }, { status: 400 });
  }

  try {
    await saveTracks(user.id, circleId, ids);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof SpotifyRateLimitError) {
      return NextResponse.json(
        {
          error: 'Spotify is a bit busy right now. Please try again in a minute.',
          rateLimited: true,
        },
        { status: 429 }
      );
    }
    throw err;
  }
}

// DELETE /api/library — remove tracks from user's library
export async function DELETE(request: NextRequest) {
  const user = await requireAuth();
  const session = await getSession();
  const circleId = session.activeCircleId;
  if (!circleId) {
    return NextResponse.json({ error: 'No active circle' }, { status: 400 });
  }

  const { ids } = await request.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Missing ids array' }, { status: 400 });
  }

  try {
    await removeSavedTracks(user.id, circleId, ids);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof SpotifyRateLimitError) {
      return NextResponse.json(
        {
          error: 'Spotify is a bit busy right now. Please try again in a minute.',
          rateLimited: true,
        },
        { status: 429 }
      );
    }
    throw err;
  }
}
