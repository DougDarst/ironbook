import { expect, test } from '@playwright/test';
import { readGitInfo } from '../../scripts/git-version';
import { VERSION } from '../../src/lib/config';
import { formatVersion } from '../../src/lib/version';

// The built app shows the version of the commit it was built from. test:e2e
// builds just before the tests, so git's current state is what was stamped.
const expected = formatVersion(VERSION, readGitInfo(process.cwd()));

test('shows the build version on the Settings screen', async ({ page }) => {
  expect(expected).toMatch(/^v\d+\.\d+\.\d+ \([0-9a-f]{7,}(-dirty)?\)$/);
  await page.goto('/#/settings');
  await expect(page.getByTestId('app-version')).toHaveText(expected);
});

test('shows the version in the laptop header only', async ({ page, isMobile }) => {
  await page.goto('/');
  const header = page.getByRole('banner').getByText(expected);
  if (isMobile) await expect(header).toBeHidden();
  else await expect(header).toBeVisible();
});
