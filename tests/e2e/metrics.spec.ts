import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { formatShortDate } from '../../src/lib/format';
import { monthLabel } from '../../src/lib/history';
import { localToday, monthOf, monthsBefore, nextMonth } from '../../src/lib/model/dates';
import { apiAs, expect, seedWorkout, signIn, slots, test, type TestUser } from './fixtures';

// Metrics: volume per session for one lift (Story 18).

const today = localToday();
/** A date `days` before today (the browser uses this machine's time zone too). */
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localToday(d);
}

/**
 * Bench: 1,000 (PR) → 1,200 (PR) → 1,100 → 1,300 (PR), the last 10 days ago.
 * Squat: one session 150 days ago, and a newer draft that must be ignored.
 */
async function seed(user: TestUser) {
  const pb = await apiAs(user);
  const ex = async (name: string) => (await pb.collection('exercises').create({ user: user.id, name })).id;
  const bench = await ex('Bench Press');
  const squat = await ex('Squat');
  const bench10 = (w: number) => slots({ weight: w, reps: 10 });
  await seedWorkout(pb, user, daysAgo(200), 'finished', [[bench, bench10(100)]]);
  await seedWorkout(pb, user, daysAgo(150), 'finished', [[squat, slots({ weight: 200, reps: 5 })]]);
  await seedWorkout(pb, user, daysAgo(100), 'finished', [[bench, bench10(120)]]);
  await seedWorkout(pb, user, daysAgo(40), 'finished', [[bench, bench10(110)]]);
  await seedWorkout(pb, user, daysAgo(10), 'finished', [[bench, bench10(130)]]);
  await seedWorkout(pb, user, today, 'draft', [[squat, slots({ weight: 999, reps: 9 })]]);
}

async function openMetrics(page: Page, user: TestUser) {
  await signIn(page, user);
  await page.goto('/#/metrics');
  await expect(page.getByTestId('volume-chart').or(page.getByText('No workouts yet'))).toBeVisible();
}

const dots = (page: Page) => page.locator('[data-testid="volume-chart"] circle.dot');
const range = (page: Page, name: string) => page.getByRole('group', { name: 'Range' }).getByRole('button', { name });
const tip = (page: Page) => page.getByTestId('chart-tip');

test('a new user sees an empty state with a way to Log', async ({ page, user }) => {
  await openMetrics(page, user);
  await expect(page.getByText('No workouts yet')).toBeVisible();
  await page.getByRole('link', { name: 'Log a workout' }).click();
  await expect(page.getByText('New workout')).toBeVisible();
});

test('opens on the lift logged most recently, with the headline and every session', async ({ page, user }) => {
  await seed(user);
  await openMetrics(page, user);
  await expect(page.getByLabel('Exercise')).toHaveValue(/.+/);
  await expect(page.getByLabel('Exercise').locator('option:checked')).toHaveText('Bench Press'); // the Squat draft is ignored

  await expect(page.getByTestId('headline-volume')).toHaveText(/^\s*1,300\s*PR\s*$/);
  await expect(page.getByTestId('headline-detail')).toHaveText(`${formatShortDate(daysAgo(10), today)} · +200 (+18%) vs last time`);

  // All (the default): 4 sessions, oldest first, PRs filled.
  await expect(range(page, 'All')).toHaveAttribute('aria-pressed', 'true');
  await expect(dots(page)).toHaveCount(4);
  expect(await dots(page).evaluateAll((cs) => cs.map((c) => c.getAttribute('data-date')))).toEqual(
    [200, 100, 40, 10].map(daysAgo),
  );
  expect(await dots(page).evaluateAll((cs) => cs.map((c) => c.classList.contains('pr')))).toEqual([true, true, false, true]);
  // Placed by date: the 100-day gap is wider than the 30-day one.
  const xs = await dots(page).evaluateAll((cs) => cs.map((c) => Number(c.getAttribute('cx'))));
  expect(xs[1]! - xs[0]!).toBeGreaterThan(xs[3]! - xs[2]!);
  // Higher volume, higher up (smaller y).
  const ys = await dots(page).evaluateAll((cs) => cs.map((c) => Number(c.getAttribute('cy'))));
  expect(ys[3]!).toBeLessThan(ys[2]!);
});

test('the range buttons narrow the chart; the headline stays on the latest session', async ({ page, user }) => {
  await seed(user);
  await openMetrics(page, user);
  await range(page, '3M').click();
  await expect(range(page, '3M')).toHaveAttribute('aria-pressed', 'true');
  await expect(dots(page)).toHaveCount(2);
  await range(page, '1Y').click();
  await expect(dots(page)).toHaveCount(4);
  await expect(page.getByTestId('headline-volume')).toHaveText(/1,300/);

  // A lift with nothing in the range says so.
  await page.getByLabel('Exercise').selectOption({ label: 'Squat' });
  await range(page, '3M').click();
  // Both charts say so.
  await expect(page.getByText('No Squat sessions in the last 3 months.')).toHaveCount(2);
  await expect(page.getByTestId('volume-chart')).toHaveCount(0);
  await expect(page.getByTestId('monthly-chart')).toHaveCount(0);
  await expect(page.getByTestId('headline-detail')).toHaveText(`${formatShortDate(daysAgo(150), today)} · first session`);
  await range(page, 'All').click();
  await expect(dots(page)).toHaveCount(1);
});

test('tapping a point shows its date and volume; tapping elsewhere hides it', async ({ page, user }) => {
  await seed(user);
  await openMetrics(page, user);
  const box = (await dots(page).nth(2).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(tip(page)).toHaveText(`${formatShortDate(daysAgo(40), today)} · 1,100`);
  await page.getByTestId('headline-volume').click();
  await expect(tip(page)).toHaveCount(0);
});

test('the arrow keys step through the sessions', async ({ page, user }) => {
  await seed(user);
  await openMetrics(page, user);
  await page.getByTestId('volume-chart').focus();
  await page.keyboard.press('End');
  await expect(tip(page)).toHaveText(`${formatShortDate(daysAgo(10), today)} · 1,300 · PR`);
  await page.keyboard.press('ArrowLeft');
  await expect(tip(page)).toHaveText(`${formatShortDate(daysAgo(40), today)} · 1,100`);
  await page.keyboard.press('Home');
  await expect(tip(page)).toHaveText(`${formatShortDate(daysAgo(200), today)} · 1,000 · PR`);
  await page.keyboard.press('Escape');
  await expect(tip(page)).toHaveCount(0);
});

test('screen readers get the sessions as a table', async ({ page, user }) => {
  await seed(user);
  await openMetrics(page, user);
  const table = page.getByRole('table', { name: 'Bench Press: volume per session' });
  await expect(table.getByRole('row')).toHaveCount(5); // header + 4
  await expect(table.getByRole('row').nth(4)).toHaveText(new RegExp(`${formatShortDate(daysAgo(10), today)}\\s*1,300\\s*PR`));
});

test('says when metrics could not load', async ({ page, user }) => {
  await signIn(page, user);
  await expect(page.getByText('New workout').or(page.getByTestId('lifted'))).toBeVisible();
  await page.route(
    (url) => url.pathname.startsWith('/api/collections/entries/records'),
    (route) => route.abort('internetdisconnected'),
  );
  await page.goto('/#/metrics');
  await expect(page.getByRole('alert')).toHaveText("Couldn't load your metrics. Check your connection and reload.");
});

test.describe('monthly totals', () => {
  const bars = (page: Page) => page.locator('[data-testid="monthly-chart"] path.bar');
  /** Every month from `from` through this month, as "YYYY-MM". */
  function monthsFrom(from: string): string[] {
    const out: string[] = [];
    for (let m = monthOf(from); m <= monthOf(today); m = nextMonth(m)) out.push(m);
    return out;
  }
  const SESSIONS = [200, 100, 40, 10].map(daysAgo); // Bench, with volumes 1,000 / 1,200 / 1,100 / 1,300
  const VOLUMES = [1_000, 1_200, 1_100, 1_300];
  const totalFor = (month: string) => SESSIONS.reduce((t, d, i) => t + (monthOf(d) === month ? VOLUMES[i]! : 0), 0);

  test('a bar per month through this month, following the range; empty months have no bar', async ({ page, user }) => {
    await seed(user);
    await openMetrics(page, user);
    const all = monthsFrom(SESSIONS[0]!);
    const withVolume = all.filter((m) => totalFor(m) > 0);
    await expect(bars(page)).toHaveCount(withVolume.length);
    expect(await bars(page).evaluateAll((ps) => ps.map((p) => p.getAttribute('data-month')))).toEqual(withVolume);
    // Every month is in the table, empty ones as 0.
    const table = page.getByRole('table', { name: 'Bench Press: monthly total volume' });
    await expect(table.getByRole('row')).toHaveCount(all.length + 1);

    await range(page, '3M').click();
    const recent = monthsFrom(monthsBefore(today, 3));
    await expect(table.getByRole('row')).toHaveCount(recent.length + 1);
    await expect(bars(page)).toHaveCount(recent.filter((m) => totalFor(m) > 0).length);
  });

  test('marks the current month and says how far it has got', async ({ page, user }) => {
    await seed(user);
    await openMetrics(page, user);
    const thisMonth = monthOf(today);
    const count = SESSIONS.filter((d) => monthOf(d) === thisMonth).length;
    await expect(page.getByTestId('current-month-note')).toHaveText(
      `${monthLabel(thisMonth).split(' ')[0]} so far (${count} ${count === 1 ? 'session' : 'sessions'}).`,
    );
    if (count > 0) {
      await expect(page.locator(`path.bar[data-month="${thisMonth}"]`)).toHaveClass(/current/);
      await expect(page.locator('path.bar.current')).toHaveCount(1);
    }
  });

  test('tapping a bar shows the month, total and sessions; arrow keys step through months', async ({ page, user }) => {
    await seed(user);
    await openMetrics(page, user);
    const month = monthOf(SESSIONS[1]!);
    await page.getByTestId('monthly-chart').scrollIntoViewIfNeeded(); // below the fold on a phone
    const bar = (await page.locator(`path.bar[data-month="${month}"]`).boundingBox())!;
    await page.mouse.click(bar.x + bar.width / 2, bar.y + bar.height / 2);
    const count = SESSIONS.filter((d) => monthOf(d) === month).length;
    await expect(page.getByTestId('monthly-tip')).toHaveText(
      new RegExp(`^${monthLabel(month)}( so far)? · ${totalFor(month).toLocaleString('en-US')} · ${count} sessions?$`),
    );

    await page.getByTestId('monthly-chart').focus();
    await page.keyboard.press('Home');
    const first = monthOf(SESSIONS[0]!);
    await expect(page.getByTestId('monthly-tip')).toHaveText(new RegExp(`^${monthLabel(first)} · 1,000 · 1 session$`));
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('monthly-tip')).toHaveCount(0);
  });

  test('sit side by side on a wide screen, stacked on a phone', async ({ page, user }) => {
    await seed(user);
    await openMetrics(page, user);
    const trend = (await page.getByRole('region', { name: 'Volume per session' }).boundingBox())!;
    const monthly = (await page.getByRole('region', { name: 'Monthly total volume' }).boundingBox())!;
    if (page.viewportSize()!.width >= 1024) {
      expect(Math.abs(monthly.y - trend.y)).toBeLessThanOrEqual(1);
      expect(monthly.x).toBeGreaterThan(trend.x + trend.width);
    } else {
      expect(monthly.y).toBeGreaterThan(trend.y + trend.height);
    }
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`has no detectable accessibility violations (${colorScheme})`, async ({ page, user }) => {
    await page.emulateMedia({ colorScheme });
    await seed(user);
    await openMetrics(page, user);
    await page.getByTestId('volume-chart').focus();
    await page.keyboard.press('End');
    await expect(tip(page)).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
