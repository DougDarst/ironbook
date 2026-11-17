import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { apiAs, expect, seedWorkout, signIn, slots, test, type TestUser } from './fixtures';

// Settings › Data › Import CSV (Story 21): choose a file, preview, confirm.

/** Four rows of the tech lead's sheet, as copied from Google Sheets. */
const SHEET_SAMPLE = path.join(import.meta.dirname, '../../src/lib/csv/fixtures/sheet-sample.tsv');

async function openSettings(page: Page, user: TestUser) {
  await signIn(page, user);
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'Data' })).toBeVisible();
}

const choose = (page: Page, file: string | { name: string; mimeType: string; buffer: Buffer }) =>
  page.getByLabel('Import CSV').setInputFiles(file);
const csv = (...lines: string[]) => ({ name: 'history.csv', mimeType: 'text/csv', buffer: Buffer.from(lines.join('\n')) });
const preview = (page: Page) => page.getByTestId('import-preview');

test('imports the sheet: preview first, then finished workouts in History', async ({ page, user }) => {
  await openSettings(page, user);
  await choose(page, SHEET_SAMPLE);

  await expect(preview(page).getByRole('heading')).toHaveText('Ready to import');
  await expect(page.getByTestId('import-entries')).toHaveText('4 entries (one per exercise per workout)');
  await expect(page.getByTestId('import-workouts')).toHaveText('4 new workouts');
  await expect(preview(page)).toContainText('Dates: 7/7/26 – 8/30/26');
  await expect(page.getByTestId('import-new-exercises')).toHaveText('1 new exercise: Barbell Squat');
  await expect(page.getByTestId('import-problems')).toHaveCount(0);

  await preview(page).getByRole('button', { name: 'Import 4 entries' }).click();
  await expect(page.getByTestId('import-result')).toHaveText('Imported 4 entries: 4 workouts created.');

  const pb = await apiAs(user);
  const workouts = await pb.collection('workouts').getFullList({ sort: 'date' });
  expect(workouts.map((w) => [w.date, w.status])).toEqual([
    ['2026-07-07', 'finished'],
    ['2026-07-11', 'finished'],
    ['2026-07-18', 'finished'],
    ['2026-08-30', 'finished'],
  ]);
  await page.goto('/#/history');
  await expect(page.getByRole('link', { name: 'Open the workout of 7/7/26' }).first()).toBeVisible();
});

test('lists rows that will not be imported, imports the rest, and never overwrites', async ({ page, user }) => {
  const pb = await apiAs(user);
  const squat = (await pb.collection('exercises').create({ user: user.id, name: 'Barbell Squat' })).id;
  await seedWorkout(pb, user, '2026-07-07', 'finished', [[squat, slots({ weight: 50, reps: 5 })]]);
  await openSettings(page, user);

  await choose(
    page,
    csv(
      'EXERCISE,DATE,W1,R1,W2,R2',
      'Barbell Squat,7/7/26,105,5,,', // already logged
      'Bench Press,7/7/26,135,8,145,', // reps missing
      'Bench Press,7/7/26,135,8,145,6', // added to the 7/7 workout
      'Curl,13/1/26,20,10,,', // not a date
    ),
  );
  await expect(page.getByTestId('import-workouts')).toHaveText('0 new workouts, 1 existing workout added to');
  await expect(page.getByTestId('import-problems').getByRole('listitem')).toHaveText([
    'Row 2: Barbell Squat on 7/7/26 is already logged.',
    'Row 3: Set 2 needs both weight and reps.',
    `Row 5: "13/1/26" isn't a date (use M/D/YY, e.g. 11/10/26).`,
  ]);
  await preview(page).getByRole('button', { name: 'Import 1 entry' }).click();
  await expect(page.getByTestId('import-result')).toHaveText(
    'Imported 1 entry: 0 workouts created, 1 existing workout added to. 3 rows skipped.',
  );

  const entries = await pb.collection('entries').getFullList({ sort: 'position', expand: 'exercise' });
  expect(entries.map((e) => [e.expand!.exercise.name, e.sets[0].weight])).toEqual([
    ['Barbell Squat', 50], // untouched
    ['Bench Press', 135],
  ]);
});

test('says when there is nothing to import, and Cancel goes back', async ({ page, user }) => {
  await openSettings(page, user);
  await choose(page, csv('EXERCISE,DATE,W1,R1', 'Squat,1/1/99,100,5'));
  await expect(preview(page).getByRole('heading')).toHaveText('Nothing to import');
  await expect(preview(page).getByRole('button', { name: /^Import/ })).toHaveCount(0);
  await preview(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(preview(page)).toHaveCount(0);
  await expect(page.getByLabel('Import CSV')).toBeAttached();
});

test('says how far it got when the import fails, and saves nothing half-done', async ({ page, user }) => {
  await openSettings(page, user);
  await choose(page, SHEET_SAMPLE);
  await page.route(
    (url) => url.pathname === '/api/batch',
    (route) => route.abort('internetdisconnected'),
  );
  await preview(page).getByRole('button', { name: 'Import 4 entries' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'The import stopped after 0 entries of 4. Check your connection, then import the same file again: entries already imported are skipped.',
  );
  const pb = await apiAs(user);
  expect(await pb.collection('workouts').getFullList()).toHaveLength(0);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the preview has no detectable accessibility violations (${colorScheme})`, async ({ page, user }) => {
    await page.emulateMedia({ colorScheme });
    await openSettings(page, user);
    await choose(page, csv('EXERCISE,DATE,W1,R1', 'Squat,7/7/26,100,5', 'Squat,7/7/26,100,5'));
    await expect(page.getByTestId('import-problems')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
