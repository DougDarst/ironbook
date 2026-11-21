import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { BENCH_SESSIONS } from '../../src/lib/calc/fixtures/bench';
import { localToday } from '../../src/lib/model/dates';
import { apiAs, expect, seedWorkout, signIn, slots, test, type TestUser } from './fixtures';

// History: opens on the lift logged most recently (its header, summary cards
// and volume chart), then its sessions: the table on laptop (768 px and up),
// cards below. "All exercises" lists every exercise in sections.

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
  await expect(page.getByRole('region', { name: 'Sessions' }).or(page.getByTestId('history-card').first())).toBeVisible();
}

/** The 13 sample bench sessions (19,200 … 23,300; 8 PRs; best 25,050 on 9/1). */
async function seedBench(user: TestUser) {
  const pb = await apiAs(user);
  const id = (await pb.collection('exercises').create({ user: user.id, name: 'Barbell Bench Press' })).id;
  for (const s of BENCH_SESSIONS) {
    const w = await pb.collection('workouts').create({ user: user.id, date: s.date, status: 'finished' });
    await pb.collection('entries').create({ user: user.id, workout: w.id, exercise: id, position: 0, sets: s.sets });
  }
}


const isWide = (page: Page) => page.viewportSize()!.width >= 768;
/** The sessions table (not the chart's hidden data table). */
const sessionsTable = (page: Page) => page.getByRole('region', { name: 'Sessions' });

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
  return page.getByRole('region', { name: 'Sessions' }).locator('tbody tr').evaluateAll((trs) =>
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

  test('lists the lift\'s finished sessions, oldest first, with month summaries, PRs and changes', async ({
    page,
    user,
  }) => {
    await seed(user);
    await openHistory(page, user); // Bench Press
    await expect(sessionsTable(page).locator('thead th')).toHaveText(['Date', 'Sets', 'Top set', 'Volume', 'Change']);
    const text = await rows(page);
    // The draft (10/16) is left out; a header per month, with its summary.
    expect(text.map((r) => r.split(' | ')[0])).toEqual([
      'September 2026 1 session · best 2,480 · 1 PR',
      '9/28',
      'October 2026 2 sessions · best 2,100 · 0 PRs',
      '10/2',
      '10/9',
    ]);
    const sessions = sessionsTable(page).locator('tr.session');
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

  test('opens on the lift logged most recently; the selector switches lift or shows them all', async ({ page, user }) => {
    await seed(user);
    await openHistory(page, user); // Bench Press: its last session (10/9) is the latest
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bench Press');
    await expect(page.locator('tr.exercise')).toHaveCount(0); // the page header names it
    await expect(page.locator('tr.session')).toHaveCount(3);
    await page.getByLabel('Exercise').selectOption({ label: 'Squat' });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Squat');
    await expect(page.locator('tr.session')).toHaveCount(1);
    await page.getByLabel('Exercise').selectOption({ label: 'All exercises' });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('All exercises');
    await expect(page.locator('tr.session')).toHaveCount(0); // the overview replaces the sessions
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
    await seedBench(user); // a long table
    await page.setViewportSize({ width: 1280, height: 600 });
    await openHistory(page, user);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
    // Scroll until the table's top has passed under the 56 px top bar.
    await page.evaluate(() => {
      const table = document.querySelector('[aria-label="Sessions"] table')!;
      window.scrollTo(0, window.scrollY + table.getBoundingClientRect().top - 56 + 300);
    });
    const header = (await sessionsTable(page).locator('thead th').first().boundingBox())!;
    expect(Math.abs(header.y - 56)).toBeLessThanOrEqual(2);
  });
});

test.describe('iPhone cards', () => {
  test.skip(({ page }) => isWide(page), 'cards are the iPhone layout');

  /** Each card's text, whitespace collapsed. */
  const cardTexts = (page: Page) =>
    page
      .getByTestId('history-card')
      .evaluateAll((cards) => cards.map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim()));

  test('shows one card per finished session, by month, with PRs and changes', async ({ page, user }) => {
    await seed(user);
    await openHistory(page, user); // Bench Press
    await expect(sessionsTable(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'Bench Press' })).toBeVisible();
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
    const chip = page.getByTestId('history-card').first().getByTestId('set-chip').nth(1);
    await chip.scrollIntoViewIfNeeded(); // below the summary cards and chart
    const set = (await chip.boundingBox())!;
    await page.mouse.click(set.x + set.width / 2, set.y + set.height / 2);
    await expect(page).toHaveURL(new RegExp(`#/workout/${workout1}$`));
    await expect(page.getByRole('tab', { name: 'Bench Press' })).toBeVisible();
  });

  test('filters to one exercise', async ({ page, user }) => {
    await seed(user);
    await openHistory(page, user);
    await page.getByLabel('Exercise').selectOption({ label: 'Squat' });
    await expect(page.getByRole('heading', { level: 2, name: 'Squat' })).toBeVisible();
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

test.describe('one lift: summary cards and volume chart', () => {
  const dots = (page: Page) => page.locator('[data-testid="session-chart"] circle.dot');

  test('shows the lift, its four summary cards, as in the mockup', async ({ page, user }) => {
    await seedBench(user);
    await openHistory(page, user);
    await expect(page.getByRole('heading', { name: 'Barbell Bench Press' }).first()).toBeVisible();
    await expect(page.getByTestId('exercise-subline')).toHaveText('13 sessions since Jul 2, 2026 · weights in lbs');
    const cards = page.getByTestId('summary-card');
    await expect(cards).toHaveText([
      /Latest volume\s*23,300\s*▲ 820 \(\+4%\) · 9\/22/,
      /Best volume · PR\s*25,050\s*Set on 9\/1 · 195\s×\s8\s×\s5/,
      /Heaviest top set\s*205 × 5\s*Up from 195\s×\s2 in July/,
      /Volume PRs\s*8 of 13\s*\+21% vs first session/,
    ]);
    await expect(cards.nth(1)).toHaveClass(/pr/);
  });

  test('charts every session in order, PRs as green dots', async ({ page, user }) => {
    await seedBench(user);
    await openHistory(page, user);
    await expect(dots(page)).toHaveCount(13);
    expect(await dots(page).evaluateAll((cs) => cs.map((c) => c.classList.contains('pr')).filter(Boolean).length)).toBe(8);
    const xs = await dots(page).evaluateAll((cs) => cs.map((c) => Number(c.getAttribute('cx'))));
    const gaps = xs.slice(1).map((x, i) => x - xs[i]!);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.5); // evenly spaced
    await expect(page.getByTestId('session-chart')).toHaveAttribute(
      'aria-label',
      /Volume went from 19,200 on 7\/2 to a high of 25,050 on 9\/1; latest 23,300 on 9\/22/,
    );
  });

  test('tap or the arrow keys read a session', async ({ page, user }) => {
    await seedBench(user);
    await openHistory(page, user);
    await page.getByTestId('session-chart').scrollIntoViewIfNeeded();
    const box = (await dots(page).nth(9).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByTestId('session-chart-tip')).toHaveText('9/1 · 25,050 · PR');
    await page.getByTestId('session-chart').focus();
    await page.keyboard.press('End');
    await expect(page.getByTestId('session-chart-tip')).toHaveText('9/22 · 23,300');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('session-chart-tip')).toHaveCount(0);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`cards and chart have no detectable accessibility violations (${colorScheme})`, async ({ page, user }) => {
      await page.emulateMedia({ colorScheme });
      await seedBench(user);
      await openHistory(page, user);
      await expect(dots(page)).toHaveCount(13);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });
  }
});

test.describe('all exercises', () => {
  /** A date `days` before today (the browser uses this machine's time zone too). */
  const daysAgo = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return localToday(d);
  };
  const cards = (page: Page) => page.getByTestId('summary-card');
  const lifts = (page: Page) => page.getByTestId('lift-row');

  async function openAllExercises(page: Page, user: TestUser) {
    await openHistory(page, user);
    await page.getByLabel('Exercise').selectOption({ label: 'All exercises' });
    await expect(page.getByRole('heading', { name: 'All exercises' })).toBeVisible();
  }

  test('sums up this month; a lift’s name opens it', async ({ page, user }) => {
    const pb = await apiAs(user);
    const bench = (await pb.collection('exercises').create({ user: user.id, name: 'Bench Press' })).id;
    const squat = (await pb.collection('exercises').create({ user: user.id, name: 'Squat' })).id;
    await seedWorkout(pb, user, daysAgo(120), 'finished', [[bench, slots({ weight: 50, reps: 10 })]]);
    await seedWorkout(pb, user, localToday(), 'finished', [
      [bench, slots({ weight: 100, reps: 10 })],
      [squat, slots({ weight: 200, reps: 10 })],
    ]);
    await openAllExercises(page, user);

    await expect(page.getByRole('group', { name: 'Period' }).getByRole('button', { name: 'This month' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('period-subline')).toContainText('2 lifts · weights in lbs');
    await expect(cards(page).nth(0)).toContainText(/Workouts\s*1/);
    await expect(cards(page).nth(1)).toContainText(/Total volume\s*3,000/);
    await expect(cards(page).nth(2)).toContainText(/PRs this month\s*2/); // both beat everything before
    await expect(cards(page).nth(2)).toHaveClass(/pr/);
    await expect(cards(page).nth(3)).toContainText('Needs two sessions of a lift');

    await expect(lifts(page)).toHaveCount(2);
    await expect(lifts(page).nth(0)).toContainText('Bench Press');
    await expect(lifts(page).nth(0)).toContainText('1,000');
    await expect(lifts(page).nth(0)).toContainText('New'); // nothing the same days last month
    await expect(lifts(page).nth(0).locator('.best')).toHaveClass(/pr/);

    await lifts(page).nth(1).getByRole('button', { name: 'Squat' }).click();
    await expect(page.getByRole('heading', { name: 'Squat' }).first()).toBeVisible();
    await expect(page.getByLabel('Exercise')).toHaveValue(squat);
    await expect(page.getByTestId('summary-card').first()).toContainText('Latest volume');
  });

  test('the last 90 days compare with the 90 days before', async ({ page, user }) => {
    const pb = await apiAs(user);
    const bench = (await pb.collection('exercises').create({ user: user.id, name: 'Bench Press' })).id;
    await seedWorkout(pb, user, daysAgo(120), 'finished', [[bench, slots({ weight: 100, reps: 10 })]]); // 1,000 before
    await seedWorkout(pb, user, daysAgo(50), 'finished', [[bench, slots({ weight: 100, reps: 10 })]]); // 1,000
    await seedWorkout(pb, user, daysAgo(10), 'finished', [[bench, slots({ weight: 120, reps: 10 })]]); // 1,200
    await openAllExercises(page, user);
    await page.getByRole('group', { name: 'Period' }).getByRole('button', { name: 'Last 90 days' }).click();

    await expect(cards(page).nth(0)).toContainText('2');
    await expect(cards(page).nth(0)).toContainText('▲ 1 vs the previous 90 days');
    await expect(cards(page).nth(1)).toContainText('2,200');
    await expect(cards(page).nth(1)).toContainText('▲ 120% vs the previous 90 days');
    await expect(cards(page).nth(2)).toContainText(/PRs · last 90 days\s*1/); // 1,200 (1,000 only tied)
    await expect(cards(page).nth(3)).toContainText('+20%');
    await expect(cards(page).nth(3)).toContainText('Bench Press · session volume since');
    await expect(page.getByRole('heading', { name: 'Last 90 days by exercise' })).toBeVisible();
    await expect(lifts(page).first()).toContainText('▲ 120%');
  });

  test('says so when the period has no workouts', async ({ page, user }) => {
    const pb = await apiAs(user);
    const bench = (await pb.collection('exercises').create({ user: user.id, name: 'Bench Press' })).id;
    await seedWorkout(pb, user, daysAgo(200), 'finished', [[bench, slots({ weight: 100, reps: 10 })]]);
    await openAllExercises(page, user);
    await expect(page.getByText('No workouts in this period yet.')).toBeVisible();
    await expect(cards(page).nth(0)).toContainText(/Workouts\s*0/);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`has no detectable accessibility violations (${colorScheme})`, async ({ page, user }) => {
      await page.emulateMedia({ colorScheme });
      const pb = await apiAs(user);
      const bench = (await pb.collection('exercises').create({ user: user.id, name: 'Bench Press' })).id;
      await seedWorkout(pb, user, daysAgo(40), 'finished', [[bench, slots({ weight: 100, reps: 10 })]]);
      await seedWorkout(pb, user, localToday(), 'finished', [[bench, slots({ weight: 120, reps: 10 })]]);
      await openAllExercises(page, user);
      await page.getByRole('group', { name: 'Period' }).getByRole('button', { name: 'Last 90 days' }).click();
      await expect(lifts(page)).toHaveCount(1);
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
  await expect(page.getByText(NAME).filter({ visible: true }).first()).toBeVisible(); // the page heading
  await expect(page.getByRole('option', { name: NAME })).toHaveCount(1); // the filter
  await page.goto(`/#/workout/${workout.id}`);
  await expect(page.getByRole('tab', { name: NAME })).toBeVisible();
  await expect(page.locator('main img, section img')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
});
