import { inject, describe, expect, it } from 'vitest';
import { client, newUser, statusOf, superuser, TEST_PASSWORD, uniqueEmail } from './helpers';

// Password sign-in, with accounts created only by the superuser.

describe('signing in', () => {
  it('signs in with the right email and password', async () => {
    const admin = await superuser();
    const { email, id } = await newUser(admin);
    const pb = client();
    await pb.collection('users').authWithPassword(email, TEST_PASSWORD);
    expect(pb.authStore.isValid).toBe(true);
    expect(pb.authStore.record?.id).toBe(id);
  });

  it('accepts the email in any case', async () => {
    const admin = await superuser();
    const { email, id } = await newUser(admin);
    const pb = client();
    await pb.collection('users').authWithPassword(email.toUpperCase(), TEST_PASSWORD);
    expect(pb.authStore.record?.id).toBe(id);
  });

  it('refuses a wrong password', async () => {
    const admin = await superuser();
    const { email } = await newUser(admin);
    const pb = client();
    expect(await statusOf(pb.collection('users').authWithPassword(email, 'wrong-password-123'))).toBe(400);
    expect(pb.authStore.isValid).toBe(false);
  });

  it("answers the same for an unknown email as for a wrong password (doesn't reveal accounts)", async () => {
    const admin = await superuser();
    const { email } = await newUser(admin);
    const responses = [];
    for (const identity of [email, uniqueEmail('nobody')]) {
      try {
        await client().collection('users').authWithPassword(identity, 'wrong-password-123');
      } catch (err) {
        const e = err as { status: number; response: unknown };
        responses.push({ status: e.status, body: e.response });
      }
    }
    expect(responses).toHaveLength(2);
    expect(responses[0]).toEqual(responses[1]);
  });

  it('offers password sign-in only, by email', async () => {
    const methods = await client().collection('users').listAuthMethods();
    expect(methods.password.enabled).toBe(true);
    expect(methods.password.identityFields).toEqual(['email']);
    expect(methods.oauth2.enabled).toBe(false);
    expect(methods.otp.enabled).toBe(false);
    expect(methods.mfa.enabled).toBe(false);
  });
});

describe('accounts are created only by the superuser', () => {
  it('refuses sign-up through the API', async () => {
    const admin = await superuser();
    const email = uniqueEmail('signup');
    expect(
      await statusOf(client().collection('users').create({ email, password: TEST_PASSWORD, passwordConfirm: TEST_PASSWORD })),
    ).toBe(403);
    const found = await admin.collection('users').getFullList({ filter: admin.filter('email = {:email}', { email }) });
    expect(found).toHaveLength(0);
  });

  it("doesn't let a signed-in user create accounts", async () => {
    const admin = await superuser();
    const { pb } = await newUser(admin);
    const email = uniqueEmail('friend');
    expect(
      await statusOf(pb.collection('users').create({ email, password: TEST_PASSWORD, passwordConfirm: TEST_PASSWORD })),
    ).toBe(403);
  });
});

describe('sessions', () => {
  it('refresh while the account exists, and end when the superuser deletes it', async () => {
    const admin = await superuser();
    const { pb, id } = await newUser(admin);
    await pb.collection('users').authRefresh();
    await admin.collection('users').delete(id);
    const status = await statusOf(pb.collection('users').authRefresh());
    expect([401, 404]).toContain(status);
  });

  it('a password reset by the superuser replaces the old password', async () => {
    const admin = await superuser();
    const { email, id } = await newUser(admin);
    await admin.collection('users').update(id, { password: 'new-password-456', passwordConfirm: 'new-password-456' });
    expect(await statusOf(client().collection('users').authWithPassword(email, TEST_PASSWORD))).toBe(400);
    await client().collection('users').authWithPassword(email, 'new-password-456');
  });
});

describe('changing your own password', () => {
  it('works with the current password', async () => {
    const admin = await superuser();
    const { pb, id, email } = await newUser(admin);
    await pb.collection('users').update(id, {
      oldPassword: TEST_PASSWORD,
      password: 'changed-password-789',
      passwordConfirm: 'changed-password-789',
    });
    await client().collection('users').authWithPassword(email, 'changed-password-789');
  });

  it('is refused without the current password, or with a wrong one', async () => {
    const admin = await superuser();
    const { pb, id, email } = await newUser(admin);
    expect(
      await statusOf(pb.collection('users').update(id, { password: 'changed-password-789', passwordConfirm: 'changed-password-789' })),
    ).toBe(400);
    expect(
      await statusOf(
        pb.collection('users').update(id, {
          oldPassword: 'not-my-password',
          password: 'changed-password-789',
          passwordConfirm: 'changed-password-789',
        }),
      ),
    ).toBe(400);
    await client().collection('users').authWithPassword(email, TEST_PASSWORD); // unchanged
  });
});

describe('rate limiting', () => {
  it('is turned on by the migrations, with a tight limit on sign-in attempts', () => {
    // As migrated, before the test server relaxes the limits (global-setup.ts).
    const limits = inject('migratedRateLimits');
    expect(limits.enabled).toBe(true);
    const auth = limits.rules.find((rule) => rule.label === '*:auth');
    expect(auth).toBeDefined();
    expect(auth!.maxRequests / auth!.duration).toBeLessThanOrEqual(1);
    // Signed-in users can create far more (batches count each create).
    const create = limits.rules.find((rule) => rule.label === '*:create' && (rule as { audience?: string }).audience === '@auth');
    expect(create!.maxRequests).toBeGreaterThanOrEqual(200);
  });
});

describe('case-insensitive sign-in', () => {
  it('finds an account created with capitals', async () => {
    const admin = await superuser();
    const email = uniqueEmail('Mixed.Case');
    await admin.collection('users').create({ email, password: TEST_PASSWORD, passwordConfirm: TEST_PASSWORD });
    for (const identity of [email, email.toLowerCase(), ` ${email.toUpperCase()} `]) {
      const pb = client();
      await pb.collection('users').authWithPassword(identity, TEST_PASSWORD);
      expect(pb.authStore.record?.email).toBe(email);
    }
  });

  it('still checks the password', async () => {
    const admin = await superuser();
    const { email } = await newUser(admin);
    expect(await statusOf(client().collection('users').authWithPassword(email.toUpperCase(), 'wrong-password-123'))).toBe(400);
  });
});
