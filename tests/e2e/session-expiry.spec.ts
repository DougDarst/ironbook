import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { localToday } from '../../src/lib/model/dates';
import { apiAs, expect, seedWorkout, signIn, slots, test, type TestUser } from './fixtures';

// The session ends while the app is open (here: the password is changed on
// another device, which ends every session). The screen stays, with what
// was typed, until the user signs in again; then it saves.

const NEW_PASSWORD = 'e2e-new-password';

/** Changes the user's password through the API, as another device would. */
async function changePasswordElsewhere(user: TestUser) {
  const pb = await apiAs(user);
  await pb.collection('users').update(user.id, {
    oldPassword: user.password,
    password: NEW_PASSWORD,
    passwordConfirm: NEW_PASSWORD,
  });
}

async function openToday(page: Page, user: TestUser) {
  const pb = await apiAs(user);
  const lift = (await pb.collection('exercises').create({ user: user.id, name: 'Bench Press' })).id;
  const workout = await seedWorkout(pb, user, localToday(), 'draft', [[lift, slots()]]);
  await signIn(page, user);
  await page.goto(`/#/workout/${workout.id}`);
  await expect(page.getByTestId('lifted')).toBeVisible();
  return workout.id;
}

const status = (page: Page) => page.getByTestId('save-status');
const reauth = (page: Page) => page.getByRole('dialog', { name: 'Signed out' });

test('a save refused because the session ended asks to sign in, keeps the typing, then saves', async ({
  page,
  user,
}) => {
  const workoutId = await openToday(page, user);
  await page.getByLabel('Set 1 weight, lbs').fill('100');
  await expect(status(page)).toHaveText('Saved');

  await changePasswordElsewhere(user);
  await page.getByLabel('Set 2 weight, lbs').fill('110');
  await expect(reauth(page)).toBeVisible();
  await expect(status(page)).toHaveText('Signed out, not saved');
  await expect(page.getByLabel('Set 2 weight, lbs')).toHaveValue('110'); // still on the screen

  // A wrong password says so and lets the user retry.
  await reauth(page).getByLabel('Password').fill(user.password);
  await reauth(page).getByRole('button', { name: 'Sign in' }).click();
  await expect(reauth(page).getByRole('alert')).toBeVisible();

  await reauth(page).getByLabel('Password').fill(NEW_PASSWORD);
  await reauth(page).getByRole('button', { name: 'Sign in' }).click();
  await expect(reauth(page)).toHaveCount(0);
  // Saved at once, not at the next retry (the first is 2 s away).
  await expect(status(page)).toHaveText('Saved', { timeout: 1_500 });

  const pb = await apiAs({ ...user, password: NEW_PASSWORD });
  const [entry] = await pb.collection('entries').getFullList({ filter: `workout = "${workoutId}"` });
  expect(entry!.sets.slice(0, 2).map((s: { weight: number | null }) => s.weight)).toEqual([100, 110]);
});

test('coming back to the app notices an ended session; Sign out leaves', async ({ page, user }) => {
  await signIn(page, user);
  await page.goto('/#/history');
  await expect(page.getByText('No workouts yet')).toBeVisible();

  await changePasswordElsewhere(user);
  // The app returns to the foreground.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(reauth(page)).toBeVisible();

  await reauth(page).getByRole('button', { name: /Sign out/ }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(reauth(page)).toHaveCount(0);
});

test('a session that is still fine is left alone', async ({ signedIn: page }) => {
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForLoadState('networkidle');
  await expect(reauth(page)).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the sign-in-again dialog has no detectable accessibility violations (${colorScheme})`, async ({
    page,
    user,
  }) => {
    await page.emulateMedia({ colorScheme });
    await signIn(page, user);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await changePasswordElsewhere(user);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(reauth(page)).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
