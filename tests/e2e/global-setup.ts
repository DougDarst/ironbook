import PocketBase from 'pocketbase';
import { relaxRateLimits } from '../support/rate-limits';
import { PB_URL, SUPERUSER } from './env';

/** Prepares the test server once it's up (see playwright.config.ts). */
export default async function globalSetup() {
  const admin = new PocketBase(PB_URL);
  await admin.collection('_superusers').authWithPassword(SUPERUSER.email, SUPERUSER.password);
  await relaxRateLimits(admin);
}
