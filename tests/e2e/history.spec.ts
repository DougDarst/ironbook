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

/** The chips' visible text, e.g. ['Ramp 95→185 3 sets', '315 × 3 ×3']. */
const chipLabels = (scope: import('@playwright/test').Locator) =>
  scope
    .getByTestId('set-chip')
    .evaluateAll((chips) => chips.map((c) => (c.querySelector('[aria-hidden="true"]')?.textContent ?? '').replace(/\s+/g, ' ').trim()));

/** A row's or card's volume cell. */
const volume = (scope: import('@playwright/test').Locator) => scope.getByTestId('volume');
/** A row's or card's change cell, as shown: [amount, percent], e.g. ['▼ 1,480', '−60%']. */
const change = (scope: import('@playwright/test').Locator) =>
  scope
    .getByTestId('change')
    .locator('[aria-hidden="true"]')
    .allTextContents()
    .then((t) => t.map((x) => x.trim()));

/** The text of each body row: "date | sets | top | volume | change", or the section/month label. */
async function rows(page: Page) {
  return page.locator('tbody tr').evaluateAll((trs) =>
    trs.map((tr) =>
      Array.from(tr.children)
        .map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim())
        .filter((t) => t !== '')
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

  test('groups finished sessions by exercise, oldest first, with month summaries, PRs and changes', async ({
    page,
    user,
  }) => {
    await seed(user);
    await openHistory(page, user);
    await expect(page.locator('thead th')).toHaveText(['Date', 'Sets', 'Top set', 'Volume', 'Change']);
    const text = await rows(page);
    // Sections are alphabetical; the draft (10/16) is left out; a header per month, with its summary.
    expect(text.map((r) => r.split(' | ')[0])).toEqual([
      'Bench Press · weights in lbs',
      'September 2026 1 session · best 2,480 · 1 PR',
      '9/28',
      'October 2026 2 sessions · best 2,100 · 0 PRs',
      '10/2',
      '10/9',
      'Squat · weights in lbs',
      'September 2026 1 session · best 1,000 · 1 PR',
      '9/28',
    ]);
    const sessions = page.locator('tbody').first().locator('tr.session');
    // Done sets only, as chips: set 3 (not done) is left out; the top set is the heaviest, most reps.
    expect(await chipLabels(sessions.first())).toEqual(['100 × 10', '110 × 8', '120 × 5']);
    await expect(sessions.first().locator('td.top')).toHaveText('120 × 5');
    // 1000 + 880 + 600 = 2,480: first session, a PR (green, tagged), no change.
    await expect(volume(sessions.nth(0))).toHaveText(/PR\s*2,480/);
    await expect(volume(sessions.nth(0))).toHaveClass(/pr/);
    expect(await change(sessions.nth(0))).toEqual(['—', 'first session']);
    // 1,000: down 1,480 (−60%), not a PR.
    await expect(volume(sessions.nth(1))).toHaveText(/^\s*1,000\s*$/);
    await expect(volume(sessions.nth(1))).not.toHaveClass(/pr/);
    expect(await change(sessions.nth(1))).toEqual(['▼ 1,480', '−60%']);
    await expect(sessions.nth(1).locator('.amount')).toHaveClass(/down/);
    // 2,100: up 1,100 (+110%), but below 2,480, so no PR.
    await expect(volume(sessions.nth(2))).not.toHaveClass(/pr/);
    expect(await change(sessions.nth(2))).toEqual(['▲ 1,100', '+110%']);
    await expect(sessions.nth(2).getByTestId('change')).toContainText('Up 1,100 (+110%) vs last time');
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

  test('fits the width without scrolling sideways, and keeps the header row pinned under the top bar', async ({
    page,
    user,
  }) => {
    await seed(user);
    await page.setViewportSize({ width: 1280, height: 420 });
    await openHistory(page, user);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
    await page.evaluate(() => window.scrollTo(0, 400));
    const header = (await page.locator('thead th').first().boundingBox())!;
    expect(Math.abs(header.y - 56)).toBeLessThanOrEqual(2); // just under the 56 px top bar
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
    await expect(bench.locator('.month-summary')).toHaveText([
      '1 session · best 2,480 · 1 PR',
      '2 sessions · best 2,100 · 0 PRs',
    ]);
    // The draft (10/16) is left out.
    const cards = bench.getByTestId('history-card');
    await expect(cards).toHaveCount(3);
    // 1000 + 880 + 600 = 2,480: first session, a PR.
    await expect(cards.nth(0).locator('.date')).toHaveText(/^\s*9\/28\s*Mon · top 120 × 5\s*$/);
    await expect(volume(cards.nth(0))).toHaveText(/PR\s*2,480/);
    expect(await change(cards.nth(0))).toEqual(['—', 'first session']);
    await expect(volume(cards.nth(1))).not.toHaveClass(/pr/);
    expect(await change(cards.nth(1))).toEqual(['▼ 1,480', '−60%']);
    expect(await change(cards.nth(2))).toEqual(['▲ 1,100', '+110%']); // below 2,480: no PR
    await expect(volume(cards.nth(2))).not.toHaveClass(/pr/);
  });

  test('shows the done sets as chips, within the screen width', async ({ page, user }) => {
    await seed(user);
    await openHistory(page, user);
    expect(await chipLabels(page.getByTestId('history-card').first())).toEqual(['100 × 10', '110 × 8', '120 × 5']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
  });

  test('tapping anywhere on a card opens that workout', async ({ page, user }) => {
    const { workout1 } = await seed(user);
    await openHistory(page, user);
    // Tap where a set is shown, not the date: the whole card is the target.
    const set = (await page.getByTestId('history-card').first().getByTestId('set-chip').nth(1).boundingBox())!;
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

test.describe('set chips and toggles', () => {
  /** Deadlift on 10/5: a ramp of 95, 135, 185 (≤ 75% of 315), then 275 × 5 and 315 × 3 three times. */
  async function seedDeadlift(user: TestUser) {
    const pb = await apiAs(user);
    const id = (await pb.collection('exercises').create({ user: user.id, name: 'Deadlift' })).id;
    await seedWorkout(pb, user, '2026-10-05', 'finished', [
      [
        id,
        slots(
          { weight: 95, reps: 10 },
          { weight: 135, reps: 5 },
          { weight: 185, reps: 3 },
          { weight: 275, reps: 5 },
          { weight: 315, reps: 3 },
          { weight: 315, reps: 3 },
          { weight: 315, reps: 3 },
        ),
      ],
    ]);
  }
  const chips = (page: Page) => (isWide(page) ? page.locator('tr.session').first() : page.getByTestId('history-card').first());
  const toggle = (page: Page, name: string) => page.getByRole('button', { name });

  test('collapse the warm-up ramp and group repeated sets by default, tinting the top weight', async ({ page, user }) => {
    await seedDeadlift(user);
    await openHistory(page, user);
    await expect(toggle(page, 'Show warm-up ramp')).toHaveAttribute('aria-pressed', 'false');
    await expect(toggle(page, 'Group repeated sets')).toHaveAttribute('aria-pressed', 'true');
    expect(await chipLabels(chips(page))).toEqual(['Ramp 95→185 3 sets', '275 × 5', '315 × 3 ×3']);
    const all = chips(page).getByTestId('set-chip');
    await expect(all.nth(0)).toHaveClass(/ramp/);
    await expect(all.nth(1)).toHaveClass(/work/);
    await expect(all.nth(2)).toHaveClass(/top/);
    // Screen readers hear what each chip means.
    await expect(all.nth(2)).toContainText('315 × 3, 3 sets, top weight');
  });

  test('show the ramp set by set, or every set on its own, and remember the choice', async ({ page, user }) => {
    await seedDeadlift(user);
    await openHistory(page, user);
    await toggle(page, 'Show warm-up ramp').click();
    await expect(toggle(page, 'Show warm-up ramp')).toHaveAttribute('aria-pressed', 'true');
    expect(await chipLabels(chips(page))).toEqual(['95 × 10', '135 × 5', '185 × 3', '275 × 5', '315 × 3 ×3']);

    await toggle(page, 'Group repeated sets').click();
    await expect(toggle(page, 'Group repeated sets')).toHaveAttribute('aria-pressed', 'false');
    expect(await chipLabels(chips(page))).toEqual(['95 × 10', '135 × 5', '185 × 3', '275 × 5', '315 × 3', '315 × 3', '315 × 3']);

    await page.reload();
    await expect(chips(page).getByTestId('set-chip').first()).toBeVisible();
    await expect(toggle(page, 'Show warm-up ramp')).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle(page, 'Group repeated sets')).toHaveAttribute('aria-pressed', 'false');
    expect(await chipLabels(chips(page))).toHaveLength(7);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`chips and toggles have no detectable accessibility violations (${colorScheme})`, async ({ page, user }) => {
      await page.emulateMedia({ colorScheme });
      await seedDeadlift(user);
      await openHistory(page, user);
      await toggle(page, 'Show warm-up ramp').click(); // ramp chips, set by set
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await toggle(page, 'Show warm-up ramp').click(); // the collapsed ramp chip
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });
  }
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
