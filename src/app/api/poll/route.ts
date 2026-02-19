import { NextRequest, NextResponse } from 'next/server';
import { runPollCycle } from '@/lib/polling';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-poll-secret');
  if (secret !== process.env.POLL_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runPollCycle();
  return NextResponse.json(result);
}
