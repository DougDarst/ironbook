import { describe, expect, it } from 'vitest';
import { client, newUser, statusOf, superuser, TEST_PASSWORD } from './helpers';

// Demo accounts: marked by the superuser; can't change their own record.

async function demoUser() {
  const admin = await superuser();
  const user = await newUser(admin, 'demo');
  await admin.collection('users').update(user.id, { demo: true });
  return { admin, ...user };
}

describe('the demo flag', () => {
  it('is off for new accounts, and the user can read it', async () => {
    const admin = await superuser();
    const { pb, id } = await newUser(admin);
    expect((await pb.collection('users').getOne(id)).demo).toBe(false);
  });

  it("can't be set by a user on their own account", async () => {
    const admin = await superuser();
    const { pb, id } = await newUser(admin);
    expect(await statusOf(pb.collection('users').update(id, { demo: true }))).toBe(404);
    // Not even alongside an allowed change.
    expect(await statusOf(pb.collection('users').update(id, { name: 'Me', demo: true }))).toBe(404);
    const record = await admin.collection('users').getOne(id);
    expect(record.demo).toBe(false);
    expect(record.name).toBe('');
  });

  it('leaves ordinary accounts free to update themselves', async () => {
    const admin = await superuser();
    const { pb, id } = await newUser(admin);
    await pb.collection('users').update(id, { name: 'Still works' });
    expect((await pb.collection('users').getOne(id)).name).toBe('Still works');
  });
});

describe('a demo account', () => {
  it('signs in and refreshes like any account, and sees that it is the demo', async () => {
    const { pb, id, email } = await demoUser();
    await pb.collection('users').authRefresh();
    expect((await pb.collection('users').getOne(id)).demo).toBe(true);
    await client().collection('users').authWithPassword(email, TEST_PASSWORD);
  });

  it("can't change its name", async () => {
    const { admin, pb, id } = await demoUser();
    expect(await statusOf(pb.collection('users').update(id, { name: 'Vandal' }))).toBe(404);
    expect((await admin.collection('users').getOne(id)).name).toBe('');
  });

  it("can't change its password, even with the current one", async () => {
    const { pb, id, email } = await demoUser();
    expect(
      await statusOf(
        pb.collection('users').update(id, {
          oldPassword: TEST_PASSWORD,
          password: 'locked-out-everyone',
          passwordConfirm: 'locked-out-everyone',
        }),
      ),
    ).toBe(404);
    await client().collection('users').authWithPassword(email, TEST_PASSWORD); // unchanged
  });

  it("can't unmark itself as the demo", async () => {
    const { admin, pb, id } = await demoUser();
    expect(await statusOf(pb.collection('users').update(id, { demo: false }))).toBe(404);
    expect((await admin.collection('users').getOne(id)).demo).toBe(true);
  });

  it('can still be managed by the superuser', async () => {
    const { admin, id, email } = await demoUser();
    await admin.collection('users').update(id, { password: 'new-demo-pass-1', passwordConfirm: 'new-demo-pass-1' });
    await client().collection('users').authWithPassword(email, 'new-demo-pass-1');
    await admin.collection('users').update(id, { demo: false });
    expect((await admin.collection('users').getOne(id)).demo).toBe(false);
  });
});
