import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ROUTES } from '../../src/lib/routes';

// Automated accessibility checks (axe) on every screen, in both themes, at
// iPhone and desktop widths. This includes color contrast for the tokens.
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    for (const route of ROUTES) {
      test(`${route} screen has no detectable accessibility violations`, async ({ page }) => {
        await page.goto(`/#/${route}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
      });
    }
  });
}
