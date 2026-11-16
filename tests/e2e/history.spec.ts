import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { apiAs, expect, seedWorkout, signIn, slots, test, type TestUser } from './fixtures';

// History: the laptop grid (also scrolls sideways on iPhone until Story 15).

async function seed(user: TestUser) {
  const pb = await apiAs(user);
  const ex = async (name: string) => (await pb.collection('exercises').create({ user: user.id, name })).id;
  const squat = await ex('Squat');
  const bench = await ex('Bench Press');
  const w1 = await seedWorkout(pb, user, '2026-09-28', 'finished', [
    [bench, slots({ weight: 100, reps: 10 }, { weight: 110, reps: 8 }, { weight: 120, reps: 6, done: false }, { weight: 120, reps: 5 })],
    [squat, slots({ weight: 200, reps: 5 })],
  ]);
  await seedWorkout(pb, user, '2026-10-02', 'finished', [[bench, slots({ weight: 100, reps: 10 })]]);
  await seedWorkout(pb, user, '2026-10-09', 'finished', [[bench, slots({ weight: 100, reps: 10 }, { weight: 110, reps: 10 })]]);
  await seedWorkout(pb, user, '2026-10-16', 'draft', [[bench, slots({ weight: 999, reps: 9 })]]);
  return { workout1: w1.id };
}

async function openHistory(page: Page, user: TestUser) {
  await signIn(page, user);
  await page.goto('/#/history');
  await expect(page.getByRole('table')).toBeVisible();
}

/** The text of each body row: "date | cells… | volume | change | %", or the section/month label. */
async function rows(page: Page) {
  return page.locator('tbody tr').evaluateAll((trs) =>
    trs.map((tr) =>
      Array.from(tr.children)
        .map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim())
        .filter((t, i, all) => t !== '' || (i > 0 && i < all.length - 3))
        .join(' | '),
    ),
  );
}

test('a new user sees an empty state with a way to Log', async ({ signedIn: page }) => {
  await page.goto('/#/history');
  await expect(page.getByText('No workouts yet')).toBeVisible();
  await page.getByRole('link', { name: 'Log a workout' }).click();
  await expect(page.getByText('New workout')).toBeVisible();
});

test('groups finished sessions by exercise, oldest first, with months, PRs and changes', async ({ page, user }) => {
  await seed(user);
  await openHistory(page, user);
  const text = await rows(page);
  // Sections are alphabetical; the draft (10/16) is left out; month dividers between.
  const summary = text.map((r) => r.split(' | ')[0]);
  expect(summary).toEqual([
    'Bench Press · each cell is lbs × reps',
    'September 2026',
    '9/28/26',
    'October 2026',
    '10/2/26',
    '10/9/26',
    'Squat · each cell is lbs × reps',
    'September 2026',
    '9/28/26',
  ]);
  const benchFirst = page.locator('tbody').first().locator('tr.session').first();
  // Done sets only, positions kept: set 3 (not done) is blank, set 4 stays in column 4.
  const cells = await benchFirst.locator('td.set').allTextContents();
  expect(cells.slice(0, 5).map((c) => c.trim())).toEqual(['100×10', '110×8', '', '120×5', '']);
  // 1000 + 880 + 600 = 2,480; first session: a PR, no change.
  await expect(benchFirst.locator('td.volume')).toHaveText(/PR\s*2,480/);
  const sessions = page.locator('tbody').first().locator('tr.session');
  await expect(sessions.nth(1)).toContainText('1,000');
  await expect(sessions.nth(1)).toContainText('−1,480');
  await expect(sessions.nth(1)).toContainText('−60%');
  await expect(sessions.nth(1).locator('.badge-pr')).toHaveCount(0);
  await expect(sessions.nth(2).locator('td.volume')).toHaveText(/^\s*2,100\s*$/); // below 2,480: no PR
});

test('filters to one exercise', async ({ page, user }) => {
  await seed(user);
  await openHistory(page, user);
  await page.getByLabel('Exercise').selectOption({ label: 'Squat' });
  await expect(page.locator('tr.exercise')).toHaveText([/Squat/]);
  await expect(page.locator('tr.session')).toHaveCount(1);
  await page.getByLabel('Exercise').selectOption({ label: 'All exercises' });
  await expect(page.locator('tr.exercise')).toHaveCount(2);
});

test('clicking a date opens that workout', async ({ page, user }) => {
  const { workout1 } = await seed(user);
  await openHistory(page, user);
  await page.getByRole('link', { name: 'Open the workout of 9/28/26' }).first().click();
  await expect(page).toHaveURL(new RegExp(`#/workout/${workout1}$`));
  await expect(page.getByRole('tab', { name: 'Bench Press' })).toBeVisible();
  await expect(page.locator('.head .label')).toHaveText('Finished');
});

test('keeps the header row and the Date column pinned while scrolling', async ({ page, user }) => {
  await seed(user);
  await openHistory(page, user);
  const frame = page.locator('.frame');
  const frameBox = (await frame.boundingBox())!;
  await frame.evaluate((el) => {
    el.scrollTop = 120;
    el.scrollLeft = 600;
  });
  const header = (await page.locator('thead th').first().boundingBox())!;
  const date = (await page.locator('tr.session th.date').last().boundingBox())!;
  expect(Math.abs(header.y - frameBox.y)).toBeLessThanOrEqual(2); // header at the top of the frame
  expect(Math.abs(date.x - frameBox.x)).toBeLessThanOrEqual(2); // Date column at its left edge
  expect(await frame.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`has no detectable accessibility violations (${colorScheme})`, async ({ page, user }) => {
    await page.emulateMedia({ colorScheme });
    await seed(user);
    await openHistory(page, user);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
