/**
 * Draws the app icon (a tilted dumbbell on the accent orange, chosen
 * 2026-11-20) and writes the files the browser and iPhone use:
 *
 *   public/favicon.svg          the tab icon, rounded corners (any size)
 *   public/favicon-32.png       for browsers without SVG favicons
 *   public/apple-touch-icon.png 180 × 180, square (iOS rounds it) for
 *                               "Add to Home Screen"
 *
 * Run `npm run icons` after changing the drawing, and commit the output.
 * The PNGs are rendered with Playwright's Chromium (already installed for
 * the E2E tests). Vite copies public/ into the build.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ACCENT = '#c2410c';

/** The dumbbell, white, in a 512 × 512 box. */
const MARK =
  '<g transform="rotate(-45 256 256)" fill="#fff">' +
  '<rect x="170" y="232" width="172" height="48" rx="10"/>' +
  '<rect x="104" y="156" width="80" height="200" rx="24"/>' +
  '<rect x="328" y="156" width="80" height="200" rx="24"/>' +
  '<rect x="62" y="200" width="48" height="112" rx="16"/>' +
  '<rect x="402" y="200" width="48" height="112" rx="16"/>' +
  '</g>';

/** The icon as SVG: rounded for tabs, square for the home screen (iOS rounds it). */
export function iconSvg(rounded: boolean): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
    `<rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="${ACCENT}"/>` +
    MARK +
    '</svg>\n'
  );
}

async function main() {
  const out = path.join(import.meta.dirname, '..', 'public');
  writeFileSync(path.join(out, 'favicon.svg'), iconSvg(true));

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const png = async (svg: string, size: number, file: string) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    await page.locator('svg').screenshot({ path: path.join(out, file), omitBackground: true });
  };
  await png(iconSvg(true), 32, 'favicon-32.png');
  await png(iconSvg(false), 180, 'apple-touch-icon.png');
  await browser.close();
  console.log('Wrote public/favicon.svg, favicon-32.png and apple-touch-icon.png');
}

await main();
