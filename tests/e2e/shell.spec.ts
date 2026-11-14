import { APP } from '../../src/lib/config';
import { expect, test } from './fixtures';

// Smoke tests for the signed-in app shell. Each runs on iPhone (WebKit,
// bottom tab bar) and desktop (Chromium, top bar); exactly one "Main"
// navigation is visible at a time, so the same steps work at both widths.

test('loads with the configured app name as the page title', async ({ signedIn: page }) => {
  await expect(page).toHaveTitle(APP.name);
  await expect(page.getByText('New workout')).toBeVisible(); // the Log tab's picker
});

test('navigates between the main screens and Settings', async ({ signedIn: page }) => {
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav).toHaveCount(1);

  for (const name of ['History', 'Metrics']) {
    await nav.getByRole('link', { name }).click();
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(nav.getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
  }
  await nav.getByRole('link', { name: 'Log' }).click();
  await expect(page.getByText('New workout')).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Log' })).toHaveAttribute('aria-current', 'page');

  await nav.getByRole('link', { name: 'Metrics' }).click();
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await expect(page).toHaveURL(/#\/settings$/);

  // The browser's back button returns to the previous screen.
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Metrics' })).toBeVisible();
});

test('opens the screen in the URL directly', async ({ signedIn: page }) => {
  await page.goto('/#/metrics');
  await expect(page.getByRole('heading', { level: 1, name: 'Metrics' })).toBeVisible();
});

for (const [scheme, background] of [
  ['light', 'rgb(244, 242, 238)'],
  ['dark', 'rgb(17, 18, 20)'],
] as const) {
  test(`follows the device's ${scheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    await expect(page.locator('body')).toHaveCSS('background-color', background);
  });
}
