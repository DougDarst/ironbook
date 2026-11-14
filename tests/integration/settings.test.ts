import { describe, expect, it } from 'vitest';
import { newUser, statusOf, superuser } from './helpers';

// What Settings saves on the user record.

describe('theme', () => {
  it('is empty (meaning "system") for a new account', async () => {
    const admin = await superuser();
    const { pb, id } = await newUser(admin);
    expect((await pb.collection('users').getOne(id)).theme).toBe('');
  });

  it('can be set by the user to system, light or dark', async () => {
    const admin = await superuser();
    const { pb, id } = await newUser(admin);
    for (const theme of ['dark', 'light', 'system']) {
      await pb.collection('users').update(id, { theme });
      expect((await pb.collection('users').getOne(id)).theme).toBe(theme);
    }
  });

  it('rejects any other value', async () => {
    const admin = await superuser();
    const { pb, id } = await newUser(admin);
    expect(await statusOf(pb.collection('users').update(id, { theme: 'neon' }))).toBe(400);
    expect((await pb.collection('users').getOne(id)).theme).toBe('');
  });

  it("can't be saved by a demo account (visitors share it)", async () => {
    const admin = await superuser();
    const { pb, id } = await newUser(admin, 'demo');
    await admin.collection('users').update(id, { demo: true });
    expect(await statusOf(pb.collection('users').update(id, { theme: 'dark' }))).toBe(404);
    expect((await admin.collection('users').getOne(id)).theme).toBe('');
  });
});
