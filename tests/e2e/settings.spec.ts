import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test } from './fixtures';

// Settings: theme, change password, sign out.

const LIGHT_BG = 'rgb(244, 242, 238)';
const DARK_BG = 'rgb(17, 18, 20)';

/** Opens Settings the way a user would: the gear sits on every screen but Log. */
async function openSettings(page: Page) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'History' }).click();
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
}

const themeOption = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Theme' }).getByRole('radio', { name });

test.describe('theme', () => {
  test.use({ colorScheme: 'light' });

  test('saves the choice to the account, so it follows the user to another device', async ({
    signedIn: page,
    admin,
    user,
    browser,
  }) => {
    await openSettings(page);
    await expect(themeOption(page, 'System')).toBeChecked();
    await themeOption(page, 'Dark').check();
    await expect(page.locator('body')).toHaveCSS('background-color', DARK_BG);
    await expect.poll(async () => (await admin.collection('users').getOne(user.id)).theme).toBe('dark');

    await page.reload();
    await expect(page.locator('body')).toHaveCSS('background-color', DARK_BG);
    await expect(themeOption(page, 'Dark')).toBeChecked();

    // A fresh browser (another device) picks it up after signing in.
    const other = await browser.newPage({ colorScheme: 'light' });
    await signIn(other, user);
    await expect(other.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await expect(other.locator('body')).toHaveCSS('background-color', DARK_BG);
    await other.close();
  });

  test('System follows the device again', async ({ signedIn: page }) => {
    await openSettings(page);
    await themeOption(page, 'Dark').check();
    await expect(page.locator('body')).toHaveCSS('background-color', DARK_BG);
    await themeOption(page, 'System').check();
    await expect(page.locator('body')).toHaveCSS('background-color', LIGHT_BG);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('body')).toHaveCSS('background-color', DARK_BG);
  });

  test('Light overrides a dark device', async ({ signedIn: page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await openSettings(page);
    await themeOption(page, 'Light').check();
    await expect(page.locator('body')).toHaveCSS('background-color', LIGHT_BG);
  });
});

test.describe('a demo account', () => {
  test.use({ colorScheme: 'light' });

  test("keeps the theme on the device and can't change its password", async ({ page, admin, user }) => {
    await admin.collection('users').update(user.id, { demo: true });
    await signIn(page, user);
    await openSettings(page);

    await expect(page.getByRole('button', { name: 'Change password' })).toHaveCount(0);
    await expect(page.getByText("This is a demo account. Its password can't be changed.")).toBeVisible();
    await expect(page.getByText('Saved on this device only.')).toBeVisible();

    await themeOption(page, 'Dark').check();
    await expect(page.locator('body')).toHaveCSS('background-color', DARK_BG);
    await page.reload();
    await expect(page.locator('body')).toHaveCSS('background-color', DARK_BG);
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect((await admin.collection('users').getOne(user.id)).theme).toBe('');
  });
});

test.describe('change password', () => {
  test('checks the form, explains server refusals, and changes the password', async ({ signedIn: page, user }) => {
    await openSettings(page);
    await page.getByRole('button', { name: 'Change password' }).click();
    const current = page.getByLabel('Current password');
    const next = page.getByLabel('New password', { exact: true });
    const confirm = page.getByLabel('Confirm new password');
    const submit = page.getByRole('button', { name: 'Save password' });

    await current.fill(user.password);
    await next.fill('short');
    await confirm.fill('short');
    await submit.click();
    await expect(page.getByRole('alert')).toHaveText('The new password needs at least 8 characters.');

    await current.fill('not-my-password');
    await next.fill('brand-new-password');
    await confirm.fill('brand-new-password');
    await submit.click();
    await expect(page.getByRole('alert')).toHaveText('Your current password is wrong.');

    await current.fill(user.password);
    await submit.click();
    await expect(page.getByRole('status')).toHaveText('Password changed. Your other devices have been signed out.');
    // Still signed in on this device.
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

    // The old password no longer works; the new one does.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, user);
    await expect(page.getByRole('alert')).toBeVisible();
    await signIn(page, { email: user.email, password: 'brand-new-password' });
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  });

  test('can be cancelled', async ({ signedIn: page }) => {
    await openSettings(page);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByLabel('Current password')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByLabel('Current password')).toHaveCount(0);
  });

  test('form has no detectable accessibility violations', async ({ signedIn: page }) => {
    await openSettings(page);
    await page.getByRole('button', { name: 'Change password' }).click();
    await page.getByRole('button', { name: 'Save password' }).click(); // submit empty: shows an error
    await expect(page.getByRole('alert')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});

test('sign out returns to the sign-in screen and stays signed out', async ({ signedIn: page }) => {
  await openSettings(page);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page).toHaveURL(/#\/$/);
  await page.reload();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
});
