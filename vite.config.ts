import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readGitInfo } from './scripts/git-version.ts';
import { APP, VERSION } from './src/lib/config.ts';
import { formatVersion } from './src/lib/version.ts';

/** Fills `%APP_NAME%` in index.html from the single app-name config. */
function appName(): Plugin {
  return {
    name: 'app-name',
    transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', APP.name),
  };
}

// Stamped into the bundle at build time (and when the dev server starts).
const appVersion = formatVersion(VERSION, readGitInfo(import.meta.dirname));

export default defineConfig({
  plugins: [svelte(), appName()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  build: {
    // PocketBase serves the frontend from pb_public.
    outDir: 'pb_public',
    emptyOutDir: true,
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    // `npm run test:coverage` (part of test:all, so CI enforces it): unit-test
    // coverage of the logic modules, failing below the thresholds.
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'scripts/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        // Talks to PocketBase: covered by the integration and E2E tests.
        'src/lib/data/**',
        'src/lib/pb.ts',
        // UI state wired to the browser and PocketBase: covered by E2E.
        'src/lib/state/{layout,router,session,theme}.svelte.ts',
      ],
      reporter: ['text-summary', 'html'],
      // Just below the level last measured (2026-11-16, Story 20); raise them as
      // coverage grows, never lower them to make a change pass.
      thresholds: { statements: 97, branches: 94, functions: 99, lines: 97 },
    },
  },
});
