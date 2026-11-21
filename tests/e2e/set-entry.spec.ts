import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { localToday } from '../../src/lib/model/dates';
import { apiAs, expect, seedWorkout, signIn, slots, test, type TestUser } from './fixtures';

// The Log screen: set entry, live totals, autosave, realtime.

type Slots = ReturnType<typeof slots>;

/** Seeds today's draft with the given exercises ({name: sets}); returns ids. */
async function seedToday(user: TestUser, exercises: Record<string, Slots>, history?: Record<string, Slots>) {
  const pb = await apiAs(user);
  const ids: Record<string, string> = {};
  for (const name of Object.keys({ ...exercises, ...history })) {
    ids[name] = (await pb.collection('exercises').create({ user: user.id, name })).id;
  }
  if (history) {
    await seedWorkout(pb, user, '2026-01-05', 'finished', Object.entries(history).map(([n, s]) => [ids[n]!, s]));
  }
  const workout = await seedWorkout(pb, user, localToday(), 'draft', Object.entries(exercises).map(([n, s]) => [ids[n]!, s]));
  const entries = await pb.collection('entries').getFullList({ filter: `workout = "${workout.id}"`, sort: 'position' });
  return { pb, workoutId: workout.id, entryIds: entries.map((e) => e.id) };
}

async function open(page: Page, user: TestUser, workoutId: string) {
  await signIn(page, user);
  await page.goto(`/#/workout/${workoutId}`);
  await expect(page.getByTestId('lifted')).toBeVisible();
  // Wait until realtime is connected, so changes from "other devices" arrive.
  await expect(page.locator('section.workout')).toHaveAttribute('data-live', 'true');
}

const weight = (page: Page, n: number) => page.getByLabel(`Set ${n} weight, lbs`);
const reps = (page: Page, n: number) => page.getByLabel(`Set ${n} reps`);
const tick = (page: Page, n: number) => page.getByRole('button', { name: `Set ${n} done` });
const saved = (page: Page) => expect(page.getByTestId('save-status')).toHaveText('Saved');

test('enters a full exercise with only the keypad and Next, replacing prefilled values', async ({ page, user }) => {
  // Prefilled from last time, so typing must replace (not append to) each value.
  const prefilled = slots(...Array.from({ length: 20 }, () => ({ weight: 45, reps: 99, done: false })));
  const { pb, workoutId, entryIds } = await seedToday(user, { 'Barbell Bench Press': prefilled });
  await open(page, user, workoutId);

  await weight(page, 1).click();
  for (let n = 1; n <= 20; n++) {
    await page.keyboard.type(String(100 + n * 5));
    await page.keyboard.press('Enter'); // → reps
    await page.keyboard.type('10');
    await page.keyboard.press('Enter'); // → next set's weight (closes the keypad after set 20)
  }
  // After set 20, nothing has focus: the keypad is closed.
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY');

  // Planned = Σ (100 + 5n) × 10 for n = 1..20 = 30,500. Nothing done yet.
  await expect(page.getByTestId('planned')).toHaveText('Planned 30,500');
  await expect(page.getByTestId('lifted')).toHaveText('0');
  await expect(weight(page, 20)).toHaveValue('200');
  await expect(reps(page, 20)).toHaveValue('10');

  await saved(page);
  const entry = await pb.collection('entries').getOne(entryIds[0]!);
  expect(entry.sets[0]).toEqual({ weight: 105, reps: 10, done: false });
  expect(entry.sets[19]).toEqual({ weight: 200, reps: 10, done: false });
});

test('updates every total live as sets are ticked', async ({ page, user }) => {
  const { workoutId } = await seedToday(
    user,
    { Squat: slots({ weight: 100, reps: 10, done: false }, { weight: 200, reps: 5, done: false }, { weight: 50, reps: 2, done: false }, { weight: 10, reps: 1, done: false }, { weight: 10, reps: 1, done: false }, { weight: 300, reps: 1, done: false }) },
    { Squat: slots({ weight: 100, reps: 10 }) },
  );
  await open(page, user, workoutId);
  await expect(page.getByTestId('last-time')).toHaveText('Last time (Jan 5) 1,000');
  await expect(page.getByText('0 of 20 sets')).toBeVisible();

  await tick(page, 1).click();
  await tick(page, 2).click();
  await tick(page, 6).click();
  await expect(page.getByTestId('lifted')).toHaveText('2,300'); // 1000 + 1000 + 300
  await expect(page.getByText('3 of 20 sets')).toBeVisible();
  await expect(page.getByText('2,000 / 2,120')).toBeVisible(); // group 1: done / total
  await expect(page.getByText('300 / 300')).toBeVisible(); // group 2
  await expect(tick(page, 1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('set-row-1')).toHaveClass(/done/);

  // Changing a done set's numbers updates the totals too.
  await reps(page, 1).fill('12');
  await expect(page.getByTestId('lifted')).toHaveText('2,500');
});

test("can't tick a set until it has weight and reps; clearing one un-ticks it", async ({ page, user }) => {
  const { pb, workoutId, entryIds } = await seedToday(user, { Row: slots({ weight: 100, reps: 10, done: true }) });
  await open(page, user, workoutId);

  await expect(tick(page, 2)).toHaveAttribute('aria-disabled', 'true');
  await tick(page, 2).click({ force: true });
  await expect(tick(page, 2)).toHaveAttribute('aria-pressed', 'false');
  await weight(page, 2).fill('0'); // bodyweight
  await reps(page, 2).fill('12');
  await expect(tick(page, 2)).not.toHaveAttribute('aria-disabled', 'true');

  await reps(page, 1).fill('');
  await expect(tick(page, 1)).toHaveAttribute('aria-pressed', 'false');
  await saved(page);
  expect((await pb.collection('entries').getOne(entryIds[0]!)).sets[0]).toEqual({ weight: 100, reps: null, done: false });
});

test('explains invalid input and never saves it', async ({ page, user }) => {
  const { pb, workoutId, entryIds } = await seedToday(user, { Curl: slots({ weight: 30, reps: 10, done: false }) });
  await open(page, user, workoutId);
  await weight(page, 1).fill('30.125');
  await expect(page.getByRole('alert')).toHaveText('Set 1: Weight can have at most 2 decimals.');
  await expect(weight(page, 1)).toHaveAttribute('aria-invalid', 'true');
  await weight(page, 1).fill('32.5');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await saved(page);
  expect((await pb.collection('entries').getOne(entryIds[0]!)).sets[0]!.weight).toBe(32.5);
});

test('autosaves, so a reload shows what was typed', async ({ page, user }) => {
  const { workoutId } = await seedToday(user, { Press: slots() });
  await open(page, user, workoutId);
  await weight(page, 1).fill('95');
  await reps(page, 1).fill('8');
  await tick(page, 1).click();
  await expect(page.getByTestId('save-status')).toHaveText(/Saving…|Saved/);
  await saved(page);
  await page.reload();
  await expect(weight(page, 1)).toHaveValue('95');
  await expect(tick(page, 1)).toHaveAttribute('aria-pressed', 'true');
});

test('saves at once when leaving the screen', async ({ page, user }) => {
  const { pb, workoutId, entryIds } = await seedToday(user, { Press: slots() });
  await open(page, user, workoutId);
  await weight(page, 1).fill('77');
  await page.getByRole('button', { name: 'Workout options' }).click();
  await page.getByRole('navigation', { name: 'Workout options' }).getByRole('link', { name: 'History' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'History' })).toBeVisible();
  await expect.poll(async () => (await pb.collection('entries').getOne(entryIds[0]!)).sets[0]!.weight).toBe(77);
});

test('saves at once when the page is hidden (switching apps on the phone)', async ({ page, user }) => {
  const { pb, workoutId, entryIds } = await seedToday(user, { Press: slots() });
  await page.clock.install();
  await open(page, user, workoutId);
  // Freeze the page's timers, so the 700 ms autosave can't be what saves.
  await page.clock.pauseAt(Date.now() + 60_000);
  const stored = async () => (await pb.collection('entries').getOne(entryIds[0]!)).sets[0]!.weight;

  await weight(page, 1).fill('66');
  await page.waitForTimeout(1_500); // real time: well past the autosave delay
  expect(await stored()).toBeNull(); // the timers really are frozen

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(stored).toBe(66);
});

test('switches between exercises with the tabs', async ({ page, user }) => {
  const { workoutId } = await seedToday(user, {
    Squat: slots({ weight: 225, reps: 5, done: false }),
    Deadlift: slots({ weight: 315, reps: 3, done: false }),
  });
  await open(page, user, workoutId);
  await expect(page.getByRole('tab', { name: 'Squat' })).toHaveAttribute('aria-selected', 'true');
  await expect(weight(page, 1)).toHaveValue('225');
  await page.getByRole('tab', { name: 'Deadlift' }).click();
  await expect(page.getByRole('tab', { name: 'Deadlift' })).toHaveAttribute('aria-selected', 'true');
  await expect(weight(page, 1)).toHaveValue('315');
  await expect(page.getByRole('heading', { level: 2, name: 'Deadlift' })).toBeVisible();
});

test('keeps the column header pinned while scrolling', async ({ page, user }) => {
  const { workoutId } = await seedToday(user, { Squat: slots() });
  await open(page, user, workoutId);
  await reps(page, 20).scrollIntoViewIfNeeded();
  const header = page.locator('.columns');
  const box = (await header.boundingBox())!;
  const viewportTop = (await page.evaluate(() => window.innerWidth)) >= 768 ? 56 : 0;
  expect(Math.abs(box.y - viewportTop)).toBeLessThanOrEqual(1);
});

test('shows changes from another device, never over the field being typed in', async ({ page, user, browser }) => {
  const { workoutId } = await seedToday(user, { Squat: slots({ weight: 100, reps: 5, done: false }) });
  await open(page, user, workoutId);
  const other = await browser.newPage();
  await open(other, user, workoutId);

  // Typing on the other device shows up here.
  await weight(other, 2).fill('150');
  await reps(other, 2).fill('3');
  await expect(weight(page, 2)).toHaveValue('150');
  await expect(reps(page, 2)).toHaveValue('3');

  // While typing in set 1's reps here, a change to that set elsewhere doesn't overwrite it.
  await reps(page, 1).click();
  await page.keyboard.type('7');
  await weight(other, 1).fill('110');
  await expect(saved(other)).resolves.toBeUndefined();
  await page.waitForTimeout(500);
  await expect(reps(page, 1)).toHaveValue('7');
  await other.close();
});

test.describe('menu', () => {
  test('leads to the other screens; Log returns to the workout', async ({ page, user }) => {
    const { workoutId } = await seedToday(user, { Squat: slots() });
    await open(page, user, workoutId);
    await page.getByRole('button', { name: 'Workout options' }).click();
    const menu = page.getByRole('navigation', { name: 'Workout options' });
    await expect(menu.getByRole('link')).toHaveText(['History', 'Settings']);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
  });
});

test.describe('room to type (iPhone)', () => {
  const tabBar = (page: Page) => page.getByRole('navigation', { name: 'Main' });
  const finishBar = (page: Page) => page.getByRole('button', { name: 'Finish workout' });

  test('the tab bar steps aside on a finished workout while a set is typed in', async ({ page, user, isMobile }) => {
    test.skip(!isMobile, 'the tab bar is the iPhone layout');
    const { pb, workoutId } = await seedToday(user, { Press: slots({ weight: 100, reps: 5 }) });
    await pb.collection('workouts').update(workoutId, { status: 'finished' });
    await open(page, user, workoutId);
    await expect(tabBar(page)).toBeVisible();

    await weight(page, 16).click();
    await expect(tabBar(page)).toHaveCount(0);
    // Moving on to the next field (Next / Enter) doesn't bring it back.
    await page.keyboard.press('Enter');
    await expect(reps(page, 16)).toBeFocused();
    await page.waitForTimeout(300);
    await expect(tabBar(page)).toHaveCount(0);
    // Done typing: it returns.
    await page.locator('#workout-title').click();
    await expect(tabBar(page)).toBeVisible();
  });

  test('the Finish bar steps aside on a draft while a set is typed in', async ({ page, user, isMobile }) => {
    const { workoutId } = await seedToday(user, { Press: slots() });
    await open(page, user, workoutId);
    await expect(finishBar(page)).toBeVisible();
    await weight(page, 1).click();
    if (isMobile) {
      await expect(finishBar(page)).toBeHidden();
      await page.locator('#workout-title').click();
      await expect(finishBar(page)).toBeVisible();
    } else {
      await expect(finishBar(page)).toBeVisible(); // a laptop has no on-screen keyboard
    }
  });
});

test.describe('heavier weights', () => {
  /** Which weight cells are marked heavier than the nearest weight above, for sets 1–n. */
  const marked = (page: Page, n: number) =>
    page
      .getByTestId('weight-cell')
      .evaluateAll((cells, count) => cells.slice(0, count).map((c) => c.classList.contains('heavier')), n);

  test('marks prefilled and typed weights heavier than the nearest weight above, live', async ({ page, user }) => {
    // Set 5 is empty; set 4 is done.
    const { workoutId } = await seedToday(user, {
      Bench: slots(
        { weight: 45, reps: 10, done: false },
        { weight: 55, reps: 10, done: false },
        { weight: 55, reps: 8, done: false },
        { weight: 50, reps: 8, done: true },
      ),
    });
    await open(page, user, workoutId);
    expect(await marked(page, 6)).toEqual([false, true, false, false, false, false]);
    // A weight in set 6 compares with set 4 (50), skipping empty set 5.
    await weight(page, 6).fill('60');
    await expect(page.getByTestId('weight-cell').nth(5)).toHaveClass(/heavier/);
    expect(await marked(page, 6)).toEqual([false, true, false, false, false, true]);
    // Raising set 4 above set 3 marks it, even though it's done; set 6 is now lighter.
    await weight(page, 4).fill('70');
    expect(await marked(page, 6)).toEqual([false, true, false, true, false, false]);
    await expect(page.getByTestId('weight-cell').nth(3).locator('.up')).toHaveText('▲');
    await expect(weight(page, 4)).toHaveAttribute('aria-describedby', 'heavier-hint');
    await expect(page.locator('#heavier-hint')).toHaveText('Heavier than the set above.');
    // Set 1 is never marked.
    await weight(page, 1).fill('300');
    expect((await marked(page, 1))[0]).toBe(false);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`marked cells have no detectable accessibility violations (${colorScheme})`, async ({ page, user }) => {
      await page.emulateMedia({ colorScheme });
      const { workoutId } = await seedToday(user, {
        Bench: slots({ weight: 45, reps: 10 }, { weight: 55, reps: 10 }, { weight: 65, reps: 8, done: false }),
      });
      await open(page, user, workoutId);
      await expect(page.getByTestId('weight-cell').nth(2)).toHaveClass(/heavier/);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });
  }
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`has no detectable accessibility violations (${colorScheme})`, async ({ page, user }) => {
    await page.emulateMedia({ colorScheme });
    const { workoutId } = await seedToday(user, {
      Squat: slots({ weight: 100, reps: 5, done: true }, { weight: 100, reps: 5, done: false }),
      Deadlift: slots(),
    });
    await open(page, user, workoutId);
    await weight(page, 3).fill('abc'); // with an error showing
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
