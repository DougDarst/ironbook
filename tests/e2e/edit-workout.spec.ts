import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { formatDayDate } from '../../src/lib/format';
import { localToday } from '../../src/lib/model/dates';
import { apiAs, expect, seedWorkout, signIn, slots, test, type TestUser } from './fixtures';

// Editing a workout from the "•••" menu: date, add, switch and remove
// exercises (Story 16). Past workouts open from History.

async function seed(user: TestUser) {
  const pb = await apiAs(user);
  const ex = async (name: string) => (await pb.collection('exercises').create({ user: user.id, name })).id;
  const bench = await ex('Bench Press');
  const squat = await ex('Squat');
  const curl = await ex('Curl');
  // Squat's last time before 9/28: the prefill source when it's added.
  await seedWorkout(pb, user, '2026-09-21', 'finished', [[squat, slots({ weight: 200, reps: 5 }, { weight: 210, reps: 3 })]]);
  const past = await seedWorkout(pb, user, '2026-09-28', 'finished', [
    [bench, slots({ weight: 100, reps: 10 }, { weight: 110, reps: 8 })],
    [curl, slots({ weight: 30, reps: 12 })],
  ]);
  const other = await seedWorkout(pb, user, '2026-10-02', 'finished', [[bench, slots({ weight: 100, reps: 10 })]]);
  return { pb, ids: { bench, squat, curl }, past: past.id, other: other.id };
}

/** Opens the 9/28 workout from History, as the story describes. */
async function openFromHistory(page: Page, user: TestUser) {
  await signIn(page, user);
  await page.goto('/#/history');
  await page.getByRole('link', { name: 'Open the workout of 9/28/26' }).first().click();
  await expect(page.getByTestId('lifted')).toBeVisible();
  await expect(page.locator('section.workout')).toHaveAttribute('data-live', 'true');
}

async function menu(page: Page, item: string) {
  await page.getByRole('button', { name: 'Workout options' }).click();
  await page.getByRole('navigation', { name: 'Workout options' }).getByRole('button', { name: item }).click();
}

const heading = (page: Page) => page.locator('#workout-title');
const tabs = (page: Page) => page.getByRole('tab');
const weight = (page: Page, set: number) => page.getByLabel(`Set ${set} weight, lbs`);
const today = localToday();

test.describe('date', () => {
  test('moves a past workout to a free date', async ({ page, user }) => {
    const { pb, past } = await seed(user);
    await openFromHistory(page, user);
    await expect(heading(page)).toHaveText(formatDayDate('2026-09-28', today));

    await menu(page, 'Change date');
    const dialog = page.getByRole('dialog', { name: 'Change date' });
    await dialog.getByLabel('Date').fill('2026-09-30');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(heading(page)).toHaveText(formatDayDate('2026-09-30', today));
    expect((await pb.collection('workouts').getOne(past)).date).toBe('2026-09-30');
  });

  test('refuses a date that already has a workout, offering to open it', async ({ page, user }) => {
    const { pb, past, other } = await seed(user);
    await openFromHistory(page, user);

    await menu(page, 'Change date');
    const dialog = page.getByRole('dialog', { name: 'Change date' });
    await dialog.getByLabel('Date').fill('2026-10-02');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog.getByRole('alert')).toContainText(
      `You already have a workout on ${formatDayDate('2026-10-02', today)}.`,
    );
    expect((await pb.collection('workouts').getOne(past)).date).toBe('2026-09-28');

    await dialog.getByRole('link', { name: /Open the workout of/ }).click();
    await expect(page).toHaveURL(new RegExp(`#/workout/${other}$`));
    await expect(heading(page)).toHaveText(formatDayDate('2026-10-02', today));
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('refuses a future date', async ({ page, user }) => {
    const { pb, past } = await seed(user);
    await openFromHistory(page, user);
    await menu(page, 'Change date');
    const dialog = page.getByRole('dialog', { name: 'Change date' });
    await dialog.getByLabel('Date').fill('2099-01-01');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog.getByRole('alert')).toHaveText("A workout can't be in the future.");
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    expect((await pb.collection('workouts').getOne(past)).date).toBe('2026-09-28');
  });
});

test.describe('exercises', () => {
  test('switches an exercise to a new one, keeping its sets', async ({ page, user }) => {
    const { pb, past } = await seed(user);
    await openFromHistory(page, user);

    await menu(page, 'Switch exercise');
    const dialog = page.getByRole('dialog', { name: 'Switch Bench Press to' });
    // Exercises already in the workout are shown but can't be picked.
    await expect(dialog.getByRole('button', { name: /^Curl/ })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: /^Squat/ })).toBeEnabled();
    await dialog.getByRole('button', { name: 'New exercise' }).click();
    await dialog.getByLabel('New exercise').fill('  incline   press ');
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(dialog).toHaveCount(0);

    await expect(tabs(page)).toHaveText(['incline press', 'Curl']);
    await expect(tabs(page).first()).toHaveAttribute('aria-selected', 'true');
    await expect(weight(page, 2)).toHaveValue('110'); // sets kept
    const entries = await pb.collection('entries').getFullList({ filter: `workout = "${past}"`, sort: 'position', expand: 'exercise' });
    expect(entries.map((e) => e.expand!.exercise.name)).toEqual(['incline press', 'Curl']);
  });

  test('adds an exercise, prefilled from last time, and selects it', async ({ page, user }) => {
    const { pb, past, ids } = await seed(user);
    await openFromHistory(page, user);

    await menu(page, 'Add exercise');
    const dialog = page.getByRole('dialog', { name: 'Add exercise' });
    await dialog.getByRole('searchbox', { name: 'Search exercises' }).fill('squ');
    await expect(dialog.getByRole('listitem')).toHaveCount(1);
    await dialog.getByRole('button', { name: 'Squat' }).click();
    await expect(dialog).toHaveCount(0);

    await expect(tabs(page)).toHaveText(['Bench Press', 'Curl', 'Squat']);
    await expect(tabs(page).nth(2)).toHaveAttribute('aria-selected', 'true');
    await expect(tabs(page).nth(2)).toBeInViewport({ ratio: 1 });
    await expect(weight(page, 1)).toHaveValue('200');
    await expect(weight(page, 2)).toHaveValue('210');
    await expect(page.getByRole('button', { name: 'Set 1 done' })).toHaveAttribute('aria-pressed', 'false');
    const added = await pb.collection('entries').getFirstListItem(`workout = "${past}" && exercise = "${ids.squat}"`);
    expect(added.position).toBe(2);
  });

  test('removes an exercise after asking; the last one stays', async ({ page, user }) => {
    const { pb, past } = await seed(user);
    await openFromHistory(page, user);
    await tabs(page).nth(1).click(); // Curl

    await menu(page, 'Remove exercise');
    const dialog = page.getByRole('dialog', { name: 'Remove Curl?' });
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(tabs(page)).toHaveCount(2);

    await menu(page, 'Remove exercise');
    await dialog.getByRole('button', { name: 'Remove' }).click();
    await expect(tabs(page)).toHaveText(['Bench Press']);
    await expect(tabs(page).first()).toHaveAttribute('aria-selected', 'true');
    expect(await pb.collection('entries').getFullList({ filter: `workout = "${past}"` })).toHaveLength(1);

    // A workout keeps at least one exercise: Delete workout is the way out.
    await page.getByRole('button', { name: 'Workout options' }).click();
    const options = page.getByRole('navigation', { name: 'Workout options' });
    await expect(options.getByRole('button', { name: 'Delete workout' })).toBeVisible();
    await expect(options.getByRole('button', { name: 'Remove exercise' })).toHaveCount(0);
  });

  test('an exercise added on another device appears, keeping what you are typing', async ({ page, user }) => {
    const { pb, past, ids } = await seed(user);
    await openFromHistory(page, user);
    await weight(page, 3).fill('120');

    await pb.collection('entries').create({ user: user.id, workout: past, exercise: ids.squat, position: 2, sets: slots() });
    await expect(tabs(page)).toHaveText(['Bench Press', 'Curl', 'Squat']);
    await expect(tabs(page).first()).toHaveAttribute('aria-selected', 'true');
    await expect(weight(page, 3)).toHaveValue('120');
    await expect(page.getByTestId('save-status')).toHaveText('Saved');
    const bench = await pb.collection('entries').getFirstListItem(`workout = "${past}" && exercise = "${ids.bench}"`);
    expect(bench.sets[2].weight).toBe(120);
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the edit dialogs have no detectable accessibility violations (${colorScheme})`, async ({ page, user }) => {
    await page.emulateMedia({ colorScheme });
    await seed(user);
    await openFromHistory(page, user);
    await menu(page, 'Switch exercise');
    await expect(page.getByRole('dialog', { name: 'Switch Bench Press to' })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.keyboard.press('Escape');
    await menu(page, 'Change date');
    await expect(page.getByRole('dialog', { name: 'Change date' })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test.describe('changes from another device', () => {
  test('a new date shows up', async ({ page, user }) => {
    const { pb, past } = await seed(user);
    await openFromHistory(page, user);
    await pb.collection('workouts').update(past, { date: '2026-09-29' });
    await expect(heading(page)).toHaveText(formatDayDate('2026-09-29', today));
  });

  test('a switched exercise shows up, keeping its sets and what you are typing', async ({ page, user }) => {
    const { pb, past, ids } = await seed(user);
    await openFromHistory(page, user);
    await tabs(page).nth(1).click(); // Curl
    await weight(page, 2).fill('35');

    const bench = await pb.collection('entries').getFirstListItem(`workout = "${past}" && exercise = "${ids.bench}"`);
    await pb.collection('entries').update(bench.id, { exercise: ids.squat });
    await expect(tabs(page)).toHaveText(['Squat', 'Curl']);
    await expect(tabs(page).nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(weight(page, 2)).toHaveValue('35');
    await expect(page.getByTestId('save-status')).toHaveText('Saved');
    await tabs(page).first().click();
    await expect(weight(page, 2)).toHaveValue('110'); // Squat now has Bench's sets
  });

  test('removing the exercise you are on moves to another, and its pending change is dropped', async ({
    page,
    user,
  }) => {
    const { pb, past, ids } = await seed(user);
    await openFromHistory(page, user);
    await tabs(page).nth(1).click(); // Curl
    await expect(tabs(page).nth(1)).toHaveAttribute('aria-selected', 'true');

    const curl = await pb.collection('entries').getFirstListItem(`workout = "${past}" && exercise = "${ids.curl}"`);
    await pb.collection('entries').delete(curl.id);
    await expect(tabs(page)).toHaveText(['Bench Press']);
    await expect(tabs(page).first()).toHaveAttribute('aria-selected', 'true');
    await expect(weight(page, 1)).toHaveValue('100');
    await expect(page.getByTestId('save-status')).toHaveText('Saved');
  });

  test('a date taken between the check and the save is still refused', async ({ page, user }) => {
    const { pb, past, other } = await seed(user);
    await openFromHistory(page, user);
    // The first "is 10/2 free?" check answers "yes", as if another device took
    // the date a moment later; the server's unique index must then refuse it.
    let first = true;
    await page.route(
      (url) => url.pathname === '/api/collections/workouts/records' && (url.searchParams.get('filter') ?? '').includes('2026-10-02'),
      async (route) => {
        if (!first) return route.fallback();
        first = false;
        await route.fulfill({ json: { page: 1, perPage: 1, totalItems: 0, totalPages: 0, items: [] } });
      },
    );
    await menu(page, 'Change date');
    const dialog = page.getByRole('dialog', { name: 'Change date' });
    await dialog.getByLabel('Date').fill('2026-10-02');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog.getByRole('alert')).toContainText(
      `You already have a workout on ${formatDayDate('2026-10-02', today)}.`,
    );
    await expect(dialog.getByRole('link', { name: /Open the workout of/ })).toHaveAttribute('href', `#/workout/${other}`);
    expect(first).toBe(false);
    expect((await pb.collection('workouts').getOne(past)).date).toBe('2026-09-28');
  });
});
