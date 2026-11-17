import type { Page } from '@playwright/test';
import { OFFLINE } from '../../src/lib/auth';
import { localToday } from '../../src/lib/model/dates';
import { apiAs, expect, seedWorkout, signIn, slots, test, type TestUser } from './fixtures';

// What each screen does when the server can't be reached: it says so,
// changes nothing, and works again once the connection is back.

/**
 * Makes requests fail like a dropped connection, for one method and API
 * path, until the returned function is called.
 */
async function failRequests(page: Page, method: string, path: string): Promise<() => Promise<void>> {
  const matcher = (url: URL) => url.pathname.startsWith(path);
  const handler = (route: import('@playwright/test').Route) =>
    route.request().method() === method ? route.abort('internetdisconnected') : route.fallback();
  await page.route(matcher, handler);
  return () => page.unroute(matcher, handler);
}

const ENTRIES = '/api/collections/entries/records';
const WORKOUTS = '/api/collections/workouts/records';
const EXERCISES = '/api/collections/exercises/records';

async function seedToday(user: TestUser, names = ['Bench Press', 'Curl']) {
  const pb = await apiAs(user);
  const entries: [string, ReturnType<typeof slots>][] = [];
  for (const name of names) {
    entries.push([(await pb.collection('exercises').create({ user: user.id, name })).id, slots({ weight: 100, reps: 5 })]);
  }
  await pb.collection('exercises').create({ user: user.id, name: 'Squat' });
  const workout = await seedWorkout(pb, user, localToday(), 'draft', entries);
  return { pb, workoutId: workout.id };
}

async function openWorkout(page: Page, user: TestUser, workoutId: string) {
  await signIn(page, user);
  await page.goto(`/#/workout/${workoutId}`);
  await expect(page.getByTestId('lifted')).toBeVisible();
  await expect(page.locator('section.workout')).toHaveAttribute('data-live', 'true');
}

async function menu(page: Page, item: string) {
  await page.getByRole('button', { name: 'Workout options' }).click();
  await page.getByRole('navigation', { name: 'Workout options' }).getByRole('button', { name: item }).click();
}

test.describe('loading', () => {
  test('History says it could not load', async ({ signedIn: page }) => {
    await failRequests(page, 'GET', ENTRIES);
    await page.goto('/#/history');
    await expect(page.getByRole('alert')).toHaveText("Couldn't load your history. Check your connection and reload.");
  });

  test('Log says it could not load', async ({ signedIn: page }) => {
    await failRequests(page, 'GET', WORKOUTS);
    await page.goto('/#/history');
    await page.goto('/#/log');
    await expect(page.getByRole('alert')).toHaveText("Couldn't load your workouts. Check your connection and reload.");
  });

  test('Choose exercises says it could not load', async ({ signedIn: page }) => {
    await failRequests(page, 'GET', EXERCISES);
    await page.goto('/#/history');
    await page.goto('/#/log');
    await expect(page.getByRole('alert')).toHaveText("Couldn't load your exercises. Check your connection and reload.");
  });

  test('a workout says it could not load', async ({ page, user }) => {
    const { workoutId } = await seedToday(user);
    await signIn(page, user);
    // Log may open today's workout straight away; start from History instead.
    await page.goto('/#/history');
    await expect(page.getByRole('heading', { name: 'History' }).first()).toBeVisible();
    await failRequests(page, 'GET', `${WORKOUTS}/${workoutId}`);
    await page.goto(`/#/workout/${workoutId}`);
    await expect(page.getByRole('alert')).toHaveText("Couldn't load this workout. Check your connection and reload.");
  });
});

test.describe('saving', () => {
  test('a failed save keeps the value, says so, and saves once the connection is back', async ({ page, user }) => {
    const { pb, workoutId } = await seedToday(user);
    await openWorkout(page, user, workoutId);
    const reconnect = await failRequests(page, 'PATCH', ENTRIES);

    await page.getByLabel('Set 1 weight, lbs').fill('135');
    await expect(page.getByTestId('save-status')).toHaveText('Not saved yet, retrying…');
    await expect(page.getByLabel('Set 1 weight, lbs')).toHaveValue('135');

    await reconnect();
    await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 10_000 });
    const [entry] = await pb.collection('entries').getFullList({ filter: `workout = "${workoutId}"`, sort: 'position' });
    expect(entry!.sets[0].weight).toBe(135);
    // Not taken for an ended session: no sign-in prompt.
    await expect(page.getByRole('dialog', { name: 'Signed out' })).toHaveCount(0);
  });

  test('starting a workout says it could not start, and stays on the picker', async ({ signedIn: page, user }) => {
    const pb = await apiAs(user);
    await pb.collection('exercises').create({ user: user.id, name: 'Squat' });
    await page.goto('/#/log');
    await page.reload(); // the picker loaded before Squat existed
    await page.getByRole('checkbox', { name: /^Squat\b/ }).check();
    await failRequests(page, 'POST', '/api/batch');
    await page.getByRole('button', { name: 'Start workout' }).click();
    await expect(page.getByRole('alert')).toHaveText("Couldn't start the workout. Please try again.");
    await expect(page.getByRole('button', { name: 'Start workout' })).toBeEnabled();
    expect(await pb.collection('workouts').getFullList()).toHaveLength(0);
  });

  test('adding a new exercise on the picker says it failed', async ({ signedIn: page }) => {
    await page.goto('/#/log');
    await page.getByRole('button', { name: 'New exercise' }).click();
    await page.getByLabel('New exercise').fill('Front Squat');
    await failRequests(page, 'GET', EXERCISES);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText("Couldn't add the exercise. Please try again.");
  });
});

test.describe('workout actions', () => {
  test('Finish says it failed and leaves the workout a draft', async ({ page, user }) => {
    const { pb, workoutId } = await seedToday(user);
    await openWorkout(page, user, workoutId);
    await failRequests(page, 'PATCH', WORKOUTS);
    await page.getByRole('button', { name: 'Finish workout' }).click();
    await expect(page.getByRole('alert')).toHaveText("Couldn't finish the workout. Please try again.");
    await expect(page.getByRole('button', { name: 'Finish workout' })).toBeEnabled();
    expect((await pb.collection('workouts').getOne(workoutId)).status).toBe('draft');
  });

  test('Delete says it failed and keeps the workout open', async ({ page, user }) => {
    const { pb, workoutId } = await seedToday(user);
    await openWorkout(page, user, workoutId);
    await failRequests(page, 'DELETE', WORKOUTS);
    await menu(page, 'Delete workout');
    await page.getByRole('dialog', { name: 'Delete workout?' }).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('alert')).toHaveText("Couldn't delete the workout. Please try again.");
    await expect(page.getByTestId('lifted')).toBeVisible();
    // Still saving: a change after the failed delete is kept.
    await page.getByLabel('Set 2 weight, lbs').fill('90');
    await expect(page.getByTestId('save-status')).toHaveText('Saved');
    expect((await pb.collection('workouts').getOne(workoutId)).id).toBe(workoutId);
  });

  test('Change date says it failed and keeps the date', async ({ page, user }) => {
    const { pb, workoutId } = await seedToday(user);
    await openWorkout(page, user, workoutId);
    await failRequests(page, 'PATCH', WORKOUTS);
    await menu(page, 'Change date');
    const dialog = page.getByRole('dialog', { name: 'Change date' });
    await dialog.getByLabel('Date').fill('2026-01-05');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog.getByRole('alert')).toContainText("Couldn't change the date. Please try again.");
    expect((await pb.collection('workouts').getOne(workoutId)).date).toBe(localToday());
  });

  test('Add exercise says it failed and adds nothing', async ({ page, user }) => {
    const { workoutId } = await seedToday(user);
    await openWorkout(page, user, workoutId);
    await failRequests(page, 'POST', ENTRIES);
    await menu(page, 'Add exercise');
    const dialog = page.getByRole('dialog', { name: 'Add exercise' });
    await dialog.getByRole('button', { name: 'Squat' }).click();
    await expect(dialog.getByRole('alert')).toHaveText("Couldn't add the exercise. Please try again.");
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('tab')).toHaveText(['Bench Press', 'Curl']);
  });

  test('Switch exercise says it failed and keeps the exercise', async ({ page, user }) => {
    const { workoutId } = await seedToday(user);
    await openWorkout(page, user, workoutId);
    await failRequests(page, 'PATCH', ENTRIES);
    await menu(page, 'Switch exercise');
    const dialog = page.getByRole('dialog', { name: 'Switch Bench Press to' });
    await dialog.getByRole('button', { name: 'Squat' }).click();
    await expect(dialog.getByRole('alert')).toHaveText("Couldn't switch the exercise. Please try again.");
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('tab')).toHaveText(['Bench Press', 'Curl']);
  });

  test('Remove exercise says it failed and keeps the exercise', async ({ page, user }) => {
    const { workoutId } = await seedToday(user);
    await openWorkout(page, user, workoutId);
    await failRequests(page, 'DELETE', ENTRIES);
    await menu(page, 'Remove exercise');
    await page.getByRole('dialog', { name: 'Remove Bench Press?' }).getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByRole('alert')).toHaveText("Couldn't remove Bench Press. Please try again.");
    await expect(page.getByRole('tab')).toHaveText(['Bench Press', 'Curl']);
  });
});

test.describe('account', () => {
  test('sign-in says the server could not be reached', async ({ page, user }) => {
    await page.goto('/');
    await failRequests(page, 'POST', '/api/collections/users/auth-with-password');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill(user.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toHaveText(OFFLINE);
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  test('a theme that could not be saved is undone and says so', async ({ signedIn: page, user }) => {
    await page.goto('/#/settings');
    await failRequests(page, 'PATCH', '/api/collections/users/records');
    // A click, not check(): the failed save puts the choice straight back.
    await page.getByRole('group', { name: 'Theme' }).getByRole('radio', { name: 'Dark' }).click();
    await expect(page.getByRole('alert')).toHaveText("Couldn't save the theme. Please try again.");
    await expect(page.getByRole('group', { name: 'Theme' }).getByRole('radio', { name: 'System' })).toBeChecked();
    expect((await (await apiAs(user)).collection('users').getOne(user.id)).theme).not.toBe('dark');
  });
});
