import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { localToday } from '../../src/lib/model/dates';
import { apiAs, expect, seedWorkout, signIn, slots, test, type TestUser } from './fixtures';

// Finishing and deleting a workout.

async function seedToday(user: TestUser, sets: ReturnType<typeof slots>[]) {
  const pb = await apiAs(user);
  const entries: [string, ReturnType<typeof slots>][] = [];
  for (const [i, s] of sets.entries()) {
    entries.push([(await pb.collection('exercises').create({ user: user.id, name: `Lift ${i + 1}` })).id, s]);
  }
  const workout = await seedWorkout(pb, user, localToday(), 'draft', entries);
  return { pb, workoutId: workout.id };
}

async function open(page: Page, user: TestUser, workoutId: string) {
  await signIn(page, user);
  await page.goto(`/#/workout/${workoutId}`);
  await expect(page.getByTestId('lifted')).toBeVisible();
  // Wait until realtime is connected, so changes from "other devices" arrive.
  await expect(page.locator('section.workout')).toHaveAttribute('data-live', 'true');
}

const finishButton = (page: Page) => page.getByRole('button', { name: 'Finish workout' });
const label = (page: Page) => page.locator('.head .label');

test('finishes at once when every entered set is ticked', async ({ page, user, isMobile }) => {
  const { pb, workoutId } = await seedToday(user, [slots({ weight: 100, reps: 5 }, { weight: 100, reps: 5 })]);
  await open(page, user, workoutId);
  if (isMobile) await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);

  await finishButton(page).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(label(page)).toHaveText('Finished');
  await expect(finishButton(page)).toHaveCount(0);
  if (isMobile) await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

  const workout = await pb.collection('workouts').getOne(workoutId);
  expect(workout.status).toBe('finished');
  expect(workout.finished_at).not.toBe('');
});

test('asks first when entered sets are not ticked, and Cancel keeps the draft', async ({ page, user }) => {
  const { pb, workoutId } = await seedToday(user, [
    slots({ weight: 100, reps: 5 }, { weight: 100, reps: 5, done: false }),
    slots({ weight: 50, reps: 10, done: false }),
  ]);
  await open(page, user, workoutId);

  await finishButton(page).click();
  const dialog = page.getByRole('dialog', { name: 'Finish workout?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("2 sets aren't ticked and won't count.");
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  expect((await pb.collection('workouts').getOne(workoutId)).status).toBe('draft');

  await finishButton(page).click();
  await page.keyboard.press('Escape'); // Escape cancels too
  await expect(dialog).toHaveCount(0);

  await finishButton(page).click();
  await dialog.getByRole('button', { name: 'Finish anyway' }).click();
  await expect(label(page)).toHaveText('Finished');
  expect((await pb.collection('workouts').getOne(workoutId)).status).toBe('finished');
});

test('saves the last change before finishing', async ({ page, user }) => {
  const { pb, workoutId } = await seedToday(user, [slots({ weight: 100, reps: 5 })]);
  await open(page, user, workoutId);
  await page.getByLabel('Set 1 reps').fill('8');
  await finishButton(page).click(); // within the autosave delay
  await expect(label(page)).toHaveText('Finished');
  const entries = await pb.collection('entries').getFullList({ filter: `workout = "${workoutId}"` });
  expect(entries[0]!.sets[0]).toEqual({ weight: 100, reps: 8, done: true });
});

test('a finished workout stays editable, and Log opens it today', async ({ page, user }) => {
  const { pb, workoutId } = await seedToday(user, [slots({ weight: 100, reps: 5 })]);
  await open(page, user, workoutId);
  await finishButton(page).click();
  await expect(label(page)).toHaveText('Finished');

  await page.getByLabel('Set 2 weight, lbs').fill('110');
  await page.getByLabel('Set 2 reps').fill('5');
  await page.getByRole('button', { name: 'Set 2 done' }).click();
  await expect(page.getByTestId('save-status')).toHaveText('Saved');
  const entries = await pb.collection('entries').getFullList({ filter: `workout = "${workoutId}"` });
  expect(entries[0]!.sets[1]).toEqual({ weight: 110, reps: 5, done: true });

  await page.goto('/#/history');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log' }).click();
  await expect(page).toHaveURL(new RegExp(`#/workout/${workoutId}$`));
  await expect(label(page)).toHaveText('Finished');
});

test('deletes the workout after confirming, then shows the picker', async ({ page, user }) => {
  const { pb, workoutId } = await seedToday(user, [slots({ weight: 100, reps: 5 }), slots()]);
  await open(page, user, workoutId);

  await page.getByRole('button', { name: 'Workout options' }).click();
  await page.getByRole('button', { name: 'Delete workout' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete workout?' });
  await expect(dialog).toContainText('and its 2 exercises, with all their sets');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await pb.collection('workouts').getOne(workoutId); // still there

  await page.getByRole('button', { name: 'Workout options' }).click();
  await page.getByRole('button', { name: 'Delete workout' }).click();
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('New workout')).toBeVisible();
  await expect(pb.collection('workouts').getOne(workoutId)).rejects.toMatchObject({ status: 404 });
  expect(await pb.collection('entries').getFullList({ filter: `workout = "${workoutId}"` })).toEqual([]);
});

test('shows finishing and deleting done on another device', async ({ page, user, browser }) => {
  const { pb, workoutId } = await seedToday(user, [slots({ weight: 100, reps: 5 })]);
  await open(page, user, workoutId);

  await pb.collection('workouts').update(workoutId, { status: 'finished' }); // "another device"
  await expect(label(page)).toHaveText('Finished');
  await expect(finishButton(page)).toHaveCount(0);

  await pb.collection('workouts').delete(workoutId);
  await expect(page.getByRole('alert')).toContainText('This workout was deleted on another device.');
  void browser;
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`dialogs have no detectable accessibility violations (${colorScheme})`, async ({ page, user }) => {
    await page.emulateMedia({ colorScheme });
    const { workoutId } = await seedToday(user, [slots({ weight: 100, reps: 5, done: false })]);
    await open(page, user, workoutId);
    await finishButton(page).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
