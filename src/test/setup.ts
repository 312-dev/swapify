/**
 * Global test setup — stubs environment variables so Zod env validation
 * in src/env.ts doesn't throw, and resets module-level singletons between tests.
 */
import { vi, beforeEach } from 'vitest';

// Stub required env vars with safe test defaults
vi.stubEnv('IRON_SESSION_PASSWORD', 'test-password-that-is-at-least-32-characters-long');
vi.stubEnv('POLL_SECRET', 'test-poll-secret-16chars');
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://test.swapify.app');
vi.stubEnv('NODE_ENV', 'test');

// Reset cached env validation between tests so stubEnv changes take effect
beforeEach(() => {
  vi.resetModules();
});
