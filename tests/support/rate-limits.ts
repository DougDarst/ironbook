import type PocketBase from 'pocketbase';

/**
 * Test servers get far higher rate limits than production. Every test
 * request comes from 127.0.0.1, so the real limits (e.g. 2 sign-ins per 3
 * seconds) would throttle parallel tests. Limiting stays enabled, so the
 * migration that turns it on is still exercised.
 */
export async function relaxRateLimits(admin: PocketBase): Promise<void> {
  await admin.settings.update({
    rateLimits: {
      enabled: true,
      rules: [{ label: '*:auth', audience: '', duration: 1, maxRequests: 10_000 }, { label: '/api/', audience: '', duration: 1, maxRequests: 10_000 }],
    },
  });
}
