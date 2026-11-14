import { describe, expect, it } from 'vitest';
import { client, statusOf, superuser, url } from './helpers';

// Smoke tests for the integration harness. Collection, rule and hook tests
// arrive with the stories that add them (Stories 5, 6 and 8).
describe('test server', () => {
  it('is healthy', async () => {
    const res = await fetch(`${url}/api/health`);
    expect(res.status).toBe(200);
  });

  it('accepts the superuser and rejects a wrong password', async () => {
    const admin = await superuser();
    expect(admin.authStore.isSuperuser).toBe(true);
    expect(await statusOf(client().collection('_superusers').authWithPassword('superuser@example.test', 'wrong'))).toBe(400);
  });

  it('does not let anonymous visitors list superusers', async () => {
    expect(await statusOf(client().collection('_superusers').getList())).toBe(403);
  });
});
