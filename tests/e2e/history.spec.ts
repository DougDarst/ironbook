import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { apiAs, expect, seedWorkout, signIn, slots, test, type TestUser } from './fixtures';

// History: the laptop grid (768 px and up) and the iPhone cards (below).

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
  await expect(page.getByRole('table').or(page.getByTestId('history-card').first())).toBeVisible();
}

const isWide = (page: Page) => page.viewportSize()!.width >= 768;

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

test.describe('laptop grid', () => {
  test.skip(({ page }) => !isWide(page), 'the grid is the laptop layout');

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
});

test.describe('iPhone cards', () => {
  test.skip(({ page }) => isWide(page), 'cards are the iPhone layout');

  /** Each card's text, whitespace collapsed. */
  const cardTexts = (page: Page) =>
    page
      .getByTestId('history-card')
      .evaluateAll((cards) => cards.map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim()));

  test('shows one card per finished session, by exercise and month, with PRs and changes', async ({ page, user }) => {
    await seed(user);
    await openHistory(page, user);
    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([/^Bench Press/, /^Squat/]);
    const bench = page.getByRole('region', { name: /Bench Press/ });
    await expect(bench.getByRole('heading', { level: 3 })).toHaveText(['September 2026', 'October 2026']);
    // The draft (10/16) is left out.
    await expect(bench.getByTestId('history-card')).toHaveCount(3);
    const text = await cardTexts(page);
    // 1000 + 880 + 600 = 2,480: first session, a PR.
    expect(text[0]).toMatch(/^9\/28\/26 Mon Volume PR 2,480 First session/);
    expect(text[1]).toMatch(/^10\/2\/26 Fri Volume 1,000 Change −1,480 · −60%/);
    expect(text[2]).toMatch(/Volume 2,100 Change \+1,100 · \+110%/); // below 2,480: no PR
    await expect(bench.getByTestId('history-card').nth(2).locator('.badge-pr')).toHaveCount(0);
  });

  test('shows done sets in rows of 5, keeping their positions', async ({ page, user }) => {
    await seed(user);
    await openHistory(page, user);
    const first = page.getByTestId('history-card').first().getByRole('listitem');
    // One row: set 3 (not done) is an empty slot, set 4 stays fourth.
    await expect(first).toHaveCount(5);
    expect((await first.allTextContents()).map((t) => t.trim())).toEqual([
      '100×10',
      '110×8',
      'Set 3 not done',
      '120×5',
      'Set 5 not done',
    ]);
    await expect(first.nth(2)).toHaveClass(/empty/);
    // Five across on one line, and nothing wider than the screen.
    const ends = await Promise.all([0, 4].map(async (i) => (await first.nth(i).boundingBox())!));
    expect(Math.abs(ends[0]!.y - ends[1]!.y)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
  });

  test('tapping anywhere on a card opens that workout', async ({ page, user }) => {
    const { workout1 } = await seed(user);
    await openHistory(page, user);
    // Tap where a set is shown, not the date: the whole card is the target.
    const set = (await page.getByTestId('history-card').first().getByRole('listitem').nth(3).boundingBox())!;
    await page.mouse.click(set.x + set.width / 2, set.y + set.height / 2);
    await expect(page).toHaveURL(new RegExp(`#/workout/${workout1}$`));
    await expect(page.getByRole('tab', { name: 'Bench Press' })).toBeVisible();
  });

  test('filters to one exercise', async ({ page, user }) => {
    await seed(user);
    await openHistory(page, user);
    await page.getByLabel('Exercise').selectOption({ label: 'Squat' });
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([/^Squat/]);
    await expect(page.getByTestId('history-card')).toHaveCount(1);
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`has no detectable accessibility violations (${colorScheme})`, async ({ page, user }) => {
    await page.emulateMedia({ colorScheme });
    await seed(user);
    await openHistory(page, user);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test('an exercise name with HTML in it shows as plain text everywhere', async ({ page, user }) => {
  const NAME = '<b>Bold</b> & <img src=x onerror="window.__xss=1">';
  const pb = await apiAs(user);
  const ex = (await pb.collection('exercises').create({ user: user.id, name: NAME })).id;
  const workout = await seedWorkout(pb, user, '2026-09-28', 'finished', [[ex, slots({ weight: 100, reps: 5 })]]);
  await openHistory(page, user);
  await expect(page.getByText(NAME).filter({ visible: true }).first()).toBeVisible(); // the section heading
  await expect(page.getByRole('option', { name: NAME })).toHaveCount(1); // the filter
  await page.goto(`/#/workout/${workout.id}`);
  await expect(page.getByRole('tab', { name: NAME })).toBeVisible();
  await expect(page.locator('main img, section img')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
});
