import PocketBase, { ClientResponseError } from 'pocketbase';
import { inject } from 'vitest';

/** URL of the throwaway PocketBase started by global-setup.ts. */
export const url = inject('pbUrl');

export function client(): PocketBase {
  const pb = new PocketBase(url);
  pb.autoCancellation(false);
  return pb;
}

export async function superuser(): Promise<PocketBase> {
  const pb = client();
  const { email, password } = inject('superuser');
  await pb.collection('_superusers').authWithPassword(email, password);
  return pb;
}

/** Resolves to the HTTP status of a failed request; fails the test if it succeeds. */
export async function statusOf(promise: Promise<unknown>): Promise<number> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof ClientResponseError) return err.status;
    throw err;
  }
  throw new Error('Expected the request to fail, but it succeeded');
}

/** A unique address, so tests sharing one server never collide. */
export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}-${crypto.randomUUID()}@example.test`;
}

export const TEST_PASSWORD = 'test-password-123';

export interface TestUser {
  /** Client signed in as this user. */
  pb: PocketBase;
  id: string;
  email: string;
}

/**
 * Creates an account the way the owner does (as superuser), then signs in
 * as it with its password.
 */
export async function newUser(admin: PocketBase, prefix = 'user'): Promise<TestUser> {
  const email = uniqueEmail(prefix);
  const record = await admin
    .collection('users')
    .create({ email, password: TEST_PASSWORD, passwordConfirm: TEST_PASSWORD });
  const pb = client();
  await pb.collection('users').authWithPassword(email, TEST_PASSWORD);
  return { pb, id: record.id, email };
}
