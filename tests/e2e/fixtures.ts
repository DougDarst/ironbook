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
