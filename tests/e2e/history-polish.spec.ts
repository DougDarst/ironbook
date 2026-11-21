import type { Page } from '@playwright/test';
import { BENCH_SESSIONS } from '../../src/lib/calc/fixtures/bench';
import { localToday } from '../../src/lib/model/dates';
import { apiAs, expect, seedWorkout, signIn, slots, test, type TestUser } from './fixtures';

// History redesign Story 7 (polish): nothing scrolls sideways on narrow
// phones, and everything that takes keyboard focus shows it.

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localToday(d);
};

/** The 13 sample bench sessions, plus a lift with a long name logged weekly since October. */
async function seed(user: TestUser) {
  const pb = await apiAs(user);
  const bench = (await pb.collection('exercises').create({ user: user.id, name: 'Barbell Bench Press' })).id;
  for (const s of BENCH_SESSIONS) {
    const w = await pb.collection('workouts').create({ user: user.id, date: s.date, status: 'finished' });
    await pb.collection('entries').create({ user: user.id, workout: w.id, exercise: bench, position: 0, sets: s.sets });
  }
  const squat = (await pb.collection('exercises').create({ user: user.id, name: 'Back Squat With A Rather Long Name' })).id;
  for (let d = 49; d >= 0; d -= 7) {
    await seedWorkout(pb, user, daysAgo(d), 'finished', [[squat, slots({ weight: 200 + d, reps: 5 }, { weight: 205.5, reps: 5 })]]);
  }
}

/** Whether the page scrolls sideways (hidden screen-reader content aside). */
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('nothing scrolls sideways at 320 or 390 px, on any History view or Metrics', async ({ page, user }, info) => {
  test.skip(info.project.name !== 'iphone-webkit', 'phone widths');
  await seed(user);
  await signIn(page, user);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/#/settings');
    await page.goto('/#/history');
    await expect(page.getByTestId('session-chart')).toBeVisible();
    expect(await overflow(page), `${width} one lift`).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Show warm-up ramp' }).click();
    expect(await overflow(page), `${width} ramp shown`).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Show warm-up ramp' }).click();
    await page.getByLabel('Exercise').selectOption({ label: 'All exercises' });
    await page.getByRole('group', { name: 'Period' }).getByRole('button', { name: 'Last 90 days' }).click();
    await expect(page.getByTestId('day-bar').first()).toBeVisible();
    expect(await overflow(page), `${width} all, bars`).toBeLessThanOrEqual(0);
    await page.getByRole('group', { name: 'Chart view' }).getByRole('button', { name: 'Progress by lift' }).click();
    expect(await overflow(page), `${width} all, lines`).toBeLessThanOrEqual(0);
    await page.goto('/#/metrics');
    await page.getByLabel('Exercise').selectOption({ label: 'Back Squat With A Rather Long Name' });
    await expect(page.getByTestId('volume-chart')).toBeVisible();
    expect(await overflow(page), `${width} metrics`).toBeLessThanOrEqual(0);
  }
});

test('every control on History shows where keyboard focus is', async ({ page, user }) => {
  await seed(user);
  await signIn(page, user);
  await page.goto('/#/history');
  await expect(page.getByTestId('session-chart')).toBeVisible();
  for (const view of ['one lift', 'all exercises']) {
    if (view === 'all exercises') await page.getByLabel('Exercise').selectOption({ label: 'All exercises' });
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    const missing = new Set<string>();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const ring = (cs: CSSStyleDeclaration) => cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
        const shown = ring(getComputedStyle(el)) || ring(getComputedStyle(el, '::after')) || getComputedStyle(el).boxShadow !== 'none';
        return shown ? null : `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}"`;
      });
      if (f) missing.add(f);
    }
    expect([...missing], view).toEqual([]);
  }
});
