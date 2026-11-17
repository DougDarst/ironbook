import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { APP } from '../../src/lib/config';
import { CSV_HEADER, parseCsv } from '../../src/lib/csv';
import { localToday } from '../../src/lib/model/dates';
import { apiAs, expect, seedWorkout, signIn, slots, test, type TestUser } from './fixtures';

// Settings › Data › Export CSV (Story 20).

async function openSettings(page: Page, user: TestUser) {
  await signIn(page, user);
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'Data' })).toBeVisible();
}

const exportButton = (page: Page) => page.getByRole('button', { name: 'Export CSV' });

test('downloads finished workouts as CSV, in the sheet format', async ({ page, user }) => {
  const pb = await apiAs(user);
  const ex = async (name: string) => (await pb.collection('exercises').create({ user: user.id, name })).id;
  const squat = await ex('Squat');
  const bench = await ex('Bench, Flat');
  await seedWorkout(pb, user, '2026-09-28', 'finished', [
    [bench, slots({ weight: 100, reps: 10 }, { weight: 110, reps: 8, done: false }, { weight: 120, reps: 5 })],
    [squat, slots({ weight: 200, reps: 5 })],
  ]);
  await seedWorkout(pb, user, '2026-10-02', 'finished', [[bench, slots({ weight: 102.5, reps: 10 })]]);
  await seedWorkout(pb, user, localToday(), 'draft', [[squat, slots({ weight: 999, reps: 9 })]]);
  await openSettings(page, user);

  const [download] = await Promise.all([page.waitForEvent('download'), exportButton(page).click()]);
  expect(download.suggestedFilename()).toBe(`${APP.name.toLowerCase()}-export-${localToday()}.csv`);
  const rows = parseCsv(readFileSync((await download.path())!, 'utf8'));
  expect(rows[0]).toEqual(CSV_HEADER);
  // By exercise, then date; the draft is left out; a not-done set is blank in its place.
  expect(rows.slice(1).map((r) => [r[0], r[1], ...r.slice(2, 8), r[42]])).toEqual([
    ['Bench, Flat', '9/28/26', '100', '10', '', '', '120', '5', '1600'],
    ['Bench, Flat', '10/2/26', '102.5', '10', '', '', '', '', '1025'],
    ['Squat', '9/28/26', '200', '5', '', '', '', '', '1000'],
  ]);
  await expect(page.getByRole('status')).toHaveText('Exported 3 entries.');
});

test('says so when there is nothing to export, without downloading', async ({ page, user }) => {
  const pb = await apiAs(user);
  const squat = (await pb.collection('exercises').create({ user: user.id, name: 'Squat' })).id;
  await seedWorkout(pb, user, localToday(), 'draft', [[squat, slots({ weight: 100, reps: 5 })]]);
  await openSettings(page, user);
  let downloaded = false;
  page.on('download', () => (downloaded = true));
  await exportButton(page).click();
  await expect(page.getByRole('status')).toHaveText('You have no finished workouts to export yet.');
  expect(downloaded).toBe(false);
});

test('says when the export failed', async ({ page, user }) => {
  await openSettings(page, user);
  await page.route(
    (url) => url.pathname.startsWith('/api/collections/entries/records'),
    (route) => route.abort('internetdisconnected'),
  );
  await exportButton(page).click();
  await expect(page.getByRole('alert')).toHaveText("Couldn't export. Check your connection and try again.");
  await expect(exportButton(page)).toBeEnabled();
});
