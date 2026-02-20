import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock polling
vi.mock('@/lib/polling', () => ({
  runPollCycle: vi.fn().mockResolvedValue({
    usersPolled: 2,
    listensRecorded: 1,
    skipsDetected: 0,
    tracksRemoved: 0,
  }),
}));

import { POST } from '@/app/api/poll/route';
import { runPollCycle } from '@/lib/polling';

function createRequest(url: string, options?: RequestInit) {
  return new NextRequest(new URL(url, 'https://test.swapify.app'), options as any);
}

describe('POST /api/poll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when x-poll-secret header is missing or wrong', async () => {
    // Missing header
    const reqNoHeader = createRequest('/api/poll', { method: 'POST' });
    const resNoHeader = await POST(reqNoHeader);
    expect(resNoHeader.status).toBe(401);
    const dataNoHeader = await resNoHeader.json();
    expect(dataNoHeader.error).toBe('Unauthorized');

    // Wrong header
    const reqWrongSecret = createRequest('/api/poll', {
      method: 'POST',
      headers: { 'x-poll-secret': 'wrong-secret' },
    });
    const resWrongSecret = await POST(reqWrongSecret);
    expect(resWrongSecret.status).toBe(401);
    const dataWrongSecret = await resWrongSecret.json();
    expect(dataWrongSecret.error).toBe('Unauthorized');
  });

  it('calls runPollCycle and returns result when secret is correct', async () => {
    const request = createRequest('/api/poll', {
      method: 'POST',
      headers: { 'x-poll-secret': 'test-poll-secret-16chars' },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({
      usersPolled: 2,
      listensRecorded: 1,
      skipsDetected: 0,
      tracksRemoved: 0,
    });

    expect(runPollCycle).toHaveBeenCalledOnce();
  });
});
