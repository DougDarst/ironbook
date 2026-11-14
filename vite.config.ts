import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { APP } from './src/lib/config.ts';

/** Fills `%APP_NAME%` in index.html from the single app-name config. */
function appName(): Plugin {
  return {
    name: 'app-name',
    transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', APP.name),
  };
}

export default defineConfig({
  plugins: [svelte(), appName()],
  build: {
    // PocketBase serves the frontend from pb_public.
    outDir: 'pb_public',
    emptyOutDir: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
