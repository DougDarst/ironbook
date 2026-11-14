import { test as base, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import PocketBase from 'pocketbase';
import { PB_URL, SUPERUSER } from './env';

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

function client(): PocketBase {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  return pb;
}

export const test = base.extend<{ admin: PocketBase; user: TestUser; signedIn: Page }>({
  admin: async ({}, use) => {
    const pb = client();
    await pb.collection('_superusers').authWithPassword(SUPERUSER.email, SUPERUSER.password);
    await use(pb);
  },

  // Each test gets its own account (created the way the owner does), so
  // tests never see each other's data.
  user: async ({ admin }, use) => {
    const email = `e2e-${randomUUID()}@example.test`;
    const password = 'e2e-user-password';
    const record = await admin.collection('users').create({ email, password, passwordConfirm: password });
    await use({ id: record.id, email, password });
  },

  signedIn: async ({ page, user }, use) => {
    await signIn(page, user);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await use(page);
  },
});

export { expect };

/** Signs in through the real sign-in form. */
export async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto('/');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** An API client signed in as `user`, for seeding their data. */
export async function apiAs(user: TestUser): Promise<PocketBase> {
  const pb = client();
  await pb.collection('users').authWithPassword(user.email, user.password);
  return pb;
}

/** Twenty set slots: the given ones filled in from slot 1. */
export function slots(...filled: { weight: number; reps: number; done?: boolean }[]) {
  return Array.from({ length: 20 }, (_, i) => {
    const f = filled[i];
    return f ? { weight: f.weight, reps: f.reps, done: f.done ?? true } : { weight: null, reps: null, done: false };
  });
}

/** Seeds a workout with entries ({exercise id: sets}) as `user`. */
export async function seedWorkout(
  pb: PocketBase,
  user: TestUser,
  date: string,
  status: 'draft' | 'finished',
  entries: [exerciseId: string, sets: ReturnType<typeof slots>][],
) {
  const workout = await pb.collection('workouts').create({ user: user.id, date, status });
  for (const [position, [exercise, sets]] of entries.entries()) {
    await pb.collection('entries').create({ user: user.id, workout: workout.id, exercise, position, sets });
  }
  return workout;
}
