import { defineConfig, devices } from '@playwright/test';
import { E2E_PORT as PORT } from './tests/e2e/env';

/**
 * End-to-end tests against the built app served by a real PocketBase.
 * Run with `npm run test:e2e` (builds first).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  // Runs once the server is up: relaxes rate limits for parallel tests.
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // The HTML report (playwright-report/, git-ignored) keeps the details of
  // any failure after the run. On CI a JSON report also lets
  // scripts/report-flaky.ts list tests that passed only on retry.
  reporter: [
    [process.env.CI ? 'github' : 'list'],
    ['html', { open: 'never' }],
    ...(process.env.CI ? [['json', { outputFile: 'playwright-results.json' }] as const] : []),
  ],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    // Chrome on iOS uses WebKit, so the primary target is tested on WebKit.
    { name: 'iphone-webkit', use: { ...devices['iPhone 15'] } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: './scripts/e2e-server.sh',
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    env: { E2E_PORT: String(PORT) },
  },
});
