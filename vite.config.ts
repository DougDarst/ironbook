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
  },
});
