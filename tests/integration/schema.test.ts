import { describe, expect, it } from 'vitest';
import { client, newUser, statusOf, superuser, uniqueEmail } from './helpers';

// The users collection's API rules.

describe('users', () => {
  async function twoUsers() {
    const admin = await superuser();
    return { admin, a: await newUser(admin, 'a'), b: await newUser(admin, 'b') };
  }

  it('lets a user see and update only their own record', async () => {
    const { a, b } = await twoUsers();
    expect((await a.pb.collection('users').getOne(a.id)).id).toBe(a.id);
    expect((await a.pb.collection('users').getFullList()).map((u) => u.id)).toEqual([a.id]);
    expect(await statusOf(a.pb.collection('users').getOne(b.id))).toBe(404);
    expect(await statusOf(a.pb.collection('users').update(b.id, { name: 'hijacked' }))).toBe(404);

    await a.pb.collection('users').update(a.id, { name: 'New name' });
    expect((await a.pb.collection('users').getOne(a.id)).name).toBe('New name');
  });

  it("doesn't let a user change another user's password", async () => {
    const { a, b } = await twoUsers();
    expect(
      await statusOf(a.pb.collection('users').update(b.id, { password: 'taken-over-123', passwordConfirm: 'taken-over-123' })),
    ).toBe(404);
  });

  it("doesn't let a user change their own email", async () => {
    const { a } = await twoUsers();
    expect(await statusOf(a.pb.collection('users').update(a.id, { email: uniqueEmail('swap') }))).toBe(400);
    expect((await a.pb.collection('users').getOne(a.id)).email).toBe(a.email);
  });

  it("doesn't let a user delete an account, even their own", async () => {
    const { admin, a, b } = await twoUsers();
    expect(await statusOf(a.pb.collection('users').delete(a.id))).toBe(403);
    expect(await statusOf(a.pb.collection('users').delete(b.id))).toBe(403);
    await admin.collection('users').getOne(a.id);
    await admin.collection('users').getOne(b.id);
  });

  it('hides users from anonymous visitors', async () => {
    const { a } = await twoUsers();
    expect((await client().collection('users').getList()).totalItems).toBe(0);
    expect(await statusOf(client().collection('users').getOne(a.id))).toBe(404);
  });
});

describe('emails', () => {
  it('are unique ignoring case', async () => {
    const admin = await superuser();
    const { email } = await newUser(admin);
    const status = await statusOf(
      admin.collection('users').create({ email: email.toUpperCase(), password: 'another-pass-123', passwordConfirm: 'another-pass-123' }),
    );
    expect(status).toBe(400);
  });
});
