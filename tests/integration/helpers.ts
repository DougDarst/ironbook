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
