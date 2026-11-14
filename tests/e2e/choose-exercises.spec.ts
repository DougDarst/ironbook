import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { localToday } from '../../src/lib/model/dates';
import { apiAs, expect, seedWorkout, slots, test } from './fixtures';

// The start of a workout: pick a date and exercises, then start.

const today = localToday();
/** A date `days` before today, as YYYY-MM-DD (the browser uses this machine's time zone too). */
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localToday(d);
}

const card = (page: Page, name: string) => page.getByRole('checkbox', { name: new RegExp(`^${name}\\b`) });
const startButton = (page: Page) => page.getByRole('button', { name: /^Start workout/ });

test('a new user sees only "New exercise" with a hint', async ({ signedIn: page }) => {
  await expect(page.getByText('New workout')).toBeVisible();
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New exercise' })).toBeVisible();
  await expect(page.getByText('Add your first exercise to start logging.')).toBeVisible();
  await expect(startButton(page)).toHaveCount(0);
});

test('adds a new exercise inline, ticked, and the Start bar replaces the tab bar', async ({ signedIn: page, isMobile }) => {
  await page.getByRole('button', { name: 'New exercise' }).click();
  await page.getByLabel('New exercise').fill('  barbell   back squat ');
  await page.getByRole('button', { name: 'Add' }).click();

  await expect(card(page, 'barbell back squat')).toBeChecked();
  await expect(page.getByText('Not logged yet')).toBeVisible();
  await expect(startButton(page)).toHaveText('Start workout (1)');
  if (isMobile) await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);

  await card(page, 'barbell back squat').uncheck();
  await expect(startButton(page)).toHaveCount(0);
  if (isMobile) await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});

test('adding a name you already have just ticks the existing one', async ({ page, user }) => {
  const pb = await apiAs(user);
  await pb.collection('exercises').create({ user: user.id, name: 'Bench Press' });
  const { signIn } = await import('./fixtures');
  await signIn(page, user);

  await page.getByRole('button', { name: 'New exercise' }).click();
  await page.getByLabel('New exercise').fill('BENCH  press');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(card(page, 'Bench Press')).toBeChecked();
  await expect(page.getByRole('checkbox')).toHaveCount(1);
});

test.describe('with history', () => {
  test.beforeEach(async ({ page, user }) => {
    const pb = await apiAs(user);
    const ex = async (name: string) => (await pb.collection('exercises').create({ user: user.id, name })).id;
    const bench = await ex('Barbell Bench Press');
    const ohp = await ex('Barbell OHP');
    await ex('Dumbbell Overhead Press');
    // Finished sessions; the newer bench one is last time. A draft never counts.
    await seedWorkout(pb, user, daysAgo(10), 'finished', [[bench, slots({ weight: 100, reps: 10 })]]);
    await seedWorkout(pb, user, daysAgo(3), 'finished', [
      [bench, slots({ weight: 135, reps: 10 }, { weight: 155, reps: 8, done: false }, { weight: 165, reps: 6 })],
      [ohp, slots({ weight: 95, reps: 5 })],
    ]);
    await seedWorkout(pb, user, daysAgo(1), 'draft', [[bench, slots({ weight: 999, reps: 1 })]]);
    const { signIn } = await import('./fixtures');
    await signIn(page, user);
  });

  test('lists exercises alphabetically with last time (done sets only, drafts ignored)', async ({ page }) => {
    await expect(page.getByRole('list', { name: 'Exercises' }).locator('.title')).toHaveText([
      'Barbell Bench Press',
      'Barbell OHP',
      'Dumbbell Overhead Press',
    ]);
    const benchCard = page.getByRole('listitem').filter({ hasText: 'Barbell Bench Press' });
    // 135×10 + 165×6 = 2,340 (the undone 155×8 doesn't count)
    await expect(benchCard).toContainText(/Last: \w{3} \d{1,2}(, \d{4})? · 2,340 lb/);
    await expect(page.getByRole('listitem').filter({ hasText: 'Dumbbell Overhead Press' })).toContainText('Not logged yet');
  });

  test('search narrows the list; ticks survive it', async ({ page }) => {
    await card(page, 'Barbell OHP').check();
    await page.getByRole('searchbox').fill('dumb press');
    await expect(page.getByRole('checkbox')).toHaveCount(1);
    await card(page, 'Dumbbell Overhead Press').check();
    await page.getByRole('searchbox').fill('deadlift');
    await expect(page.getByText('No exercises match “deadlift”.')).toBeVisible();
    await page.getByRole('searchbox').fill('');
    await expect(page.getByRole('checkbox')).toHaveCount(3);
    await expect(startButton(page)).toHaveText('Start workout (2)');
  });

  test('starts a draft with entries in the order ticked, prefilled from last time', async ({ page, user }) => {
    await card(page, 'Dumbbell Overhead Press').check();
    await card(page, 'Barbell Bench Press').check();
    await startButton(page).click();

    await expect(page).toHaveURL(/#\/workout\/[a-z0-9]{15}$/);
    const id = page.url().split('/').pop()!;
    await expect(page.getByRole('list', { name: 'Exercises' }).getByRole('listitem')).toHaveText([
      'Dumbbell Overhead Press',
      'Barbell Bench Press',
    ]);

    const pb = await apiAs(user);
    const workout = await pb.collection('workouts').getOne(id);
    expect(workout).toMatchObject({ date: today, status: 'draft' });
    const entries = await pb.collection('entries').getFullList({ filter: `workout = "${id}"`, sort: 'position', expand: 'exercise' });
    expect(entries.map((e) => e.expand!.exercise.name)).toEqual(['Dumbbell Overhead Press', 'Barbell Bench Press']);
    // New exercise: 20 empty slots. Bench: last finished session's numbers, nothing done.
    expect(entries[0]!.sets).toEqual(slots());
    expect(entries[1]!.sets.slice(0, 4)).toEqual([
      { weight: 135, reps: 10, done: false },
      { weight: 155, reps: 8, done: false },
      { weight: 165, reps: 6, done: false },
      { weight: null, reps: null, done: false },
    ]);

    // The Log tab now opens today's workout instead of the picker.
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'History' }).click();
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log' }).click();
    await expect(page).toHaveURL(new RegExp(`#/workout/${id}$`));
  });

  test('changes the date; a date that has a workout opens it; future dates are ignored', async ({ page }) => {
    const date = page.getByLabel('Workout date');
    const heading = page.getByRole('heading', { level: 1 });
    const before = await heading.textContent();

    await date.fill(daysAgo(5));
    await expect(heading).not.toHaveText(before!);
    await expect(page.getByText('New workout')).toBeVisible();

    await date.fill(daysAgo(-1)); // tomorrow
    await expect(page.getByText('New workout')).toBeVisible();
    await expect(heading).not.toHaveText(before!);

    await date.fill(daysAgo(3)); // has a finished workout
    await expect(page).toHaveURL(/#\/workout\/[a-z0-9]{15}$/);
    await expect(page.getByText('Finished workout')).toBeVisible();
  });

  test('last time is relative to the chosen date', async ({ page }) => {
    await page.getByLabel('Workout date').fill(daysAgo(5)); // before the newer session
    const benchCard = page.getByRole('listitem').filter({ hasText: 'Barbell Bench Press' });
    await expect(benchCard).toContainText('· 1,000 lb'); // 100×10, ten days ago
    await expect(page.getByRole('listitem').filter({ hasText: 'Barbell OHP' })).toContainText('Not logged yet');
  });

  test('has no detectable accessibility violations, ticked and adding', async ({ page }) => {
    await card(page, 'Barbell OHP').check();
    await page.getByRole('button', { name: 'New exercise' }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});

test('the Start bar never covers the end of the page', async ({ page, user }) => {
  const pb = await apiAs(user);
  for (const name of ['A Lift', 'B Lift', 'C Lift', 'D Lift', 'E Lift', 'F Lift', 'G Lift']) {
    await pb.collection('exercises').create({ user: user.id, name });
  }
  const { signIn } = await import('./fixtures');
  await signIn(page, user);
  await card(page, 'A Lift').check();
  // Scrolled to the very bottom, the last text sits above the bar.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const hintBox = (await page.getByText('Each exercise you pick opens').boundingBox())!;
  const barBox = (await startButton(page).boundingBox())!;
  expect(hintBox.y + hintBox.height).toBeLessThanOrEqual(barBox.y);
});

test('allows at most 20 exercises per workout', async ({ page, user }) => {
  const pb = await apiAs(user);
  const names = Array.from({ length: 21 }, (_, i) => `Lift ${String(i + 1).padStart(2, '0')}`);
  for (const name of names) await pb.collection('exercises').create({ user: user.id, name });
  const { signIn } = await import('./fixtures');
  await signIn(page, user);

  for (const name of names.slice(0, 20)) await card(page, name).check();
  await expect(startButton(page)).toHaveText('Start workout (20)');
  await expect(page.getByText('20 exercises is the most for one workout.')).toBeVisible();
  await expect(card(page, 'Lift 21')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'New exercise' })).toBeDisabled();

  await card(page, 'Lift 01').uncheck();
  await expect(card(page, 'Lift 21')).toBeEnabled();
  await card(page, 'Lift 21').check();
  await expect(startButton(page)).toHaveText('Start workout (20)');
});
