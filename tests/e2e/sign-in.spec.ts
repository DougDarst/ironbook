import { WRONG_CREDENTIALS } from '../../src/lib/auth';
import { expect, signIn, test } from './fixtures';

// Password sign-in through the real form.

test('shows the sign-in form when signed out', async ({ page }) => {
  await page.goto('/#/history');
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
});

test('signs in and stays signed in after a reload', async ({ page, user }) => {
  await signIn(page, user);
  await expect(page.getByText('New workout')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});

test('signs in with the keyboard alone, ignoring email case', async ({ page, user }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill(`  ${user.email.toUpperCase()}`);
  await page.getByLabel('Email').press('Tab');
  await page.keyboard.type(user.password);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});

test('refuses a wrong password, clears it, and lets the user retry', async ({ page, user }) => {
  await signIn(page, { email: user.email, password: 'not-the-password' });
  await expect(page.getByRole('alert')).toHaveText(WRONG_CREDENTIALS);
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
  await expect(page.getByLabel('Password')).toHaveValue('');
  await expect(page.getByLabel('Password')).toBeFocused();
  await expect(page.getByLabel('Email')).toHaveValue(user.email);

  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});

test('gives the same answer for an unknown email', async ({ page }) => {
  await signIn(page, { email: 'nobody@example.test', password: 'whatever-123' });
  await expect(page.getByRole('alert')).toHaveText(WRONG_CREDENTIALS);
});

test('signs out a deleted account the next time the app loads', async ({ signedIn: page, admin, user }) => {
  await admin.collection('users').delete(user.id);
  await page.reload();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
});
