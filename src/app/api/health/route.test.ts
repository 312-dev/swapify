import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb } from '@/test/db-setup';

// Mock logger to suppress output
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

describe('GET /api/health', () => {
  beforeAll(async () => {
    const testDb = await setupTestDb();
    vi.doMock('@/db', () => ({ db: testDb }));
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('returns 200 when DB is reachable', async () => {
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  it('returns 503 when DB throws', async () => {
    vi.doMock('@/db', () => ({
      db: {
        select: () => ({
          from: () => ({
            limit: () => {
              throw new Error('connection refused');
            },
          }),
        }),
      },
    }));

    // Dynamic import picks up the new mock
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.status).toBe('error');
    expect(data.message).toBe('Database unreachable');
  });
});
