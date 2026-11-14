import AxeBuilder from '@axe-core/playwright';
import { ROUTES } from '../../src/lib/routes';
import { expect, signIn, test } from './fixtures';

// Automated accessibility checks (axe) on every screen, in both themes, at
// iPhone and desktop widths. This includes color contrast for the tokens.
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    test('sign-in screen has no detectable accessibility violations', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByLabel('Email')).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });

    test('sign-in screen with an error message has no violations', async ({ page }) => {
      await signIn(page, { email: 'nobody@example.test', password: 'wrong-password' });
      await expect(page.getByRole('alert')).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });

    test('every screen has no detectable accessibility violations', async ({ signedIn: page }) => {
      for (const route of ROUTES) {
        await page.goto(`/#/${route}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations, `${route} screen`).toEqual([]);
      }
    });
  });
}
