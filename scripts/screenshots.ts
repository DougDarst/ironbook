/**
 * Takes the README screenshots (docs/screenshots/*.png) from a throwaway
 * local PocketBase holding the demo sample (src/lib/demo/sample.ts), with
 * the clock frozen on a Monday evening so every run looks the same.
 *
 *   npm run screenshots     # builds first; needs `npm run pb:setup` and Playwright's WebKit + Chromium
 *
 * Steps: start PocketBase on a temp folder (this repo's migrations and
 * hooks, the built app), create a demo user, import the sample through the
 * real Settings › Import, add Monday's workout in progress, then capture
 * Log, History (one lift and all exercises) at iPhone size and History on
 * a desktop. Never touches pb_data or the live site. Run by hand when the
 * screens change, then commit the images.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices, webkit, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';
import { runnerImport } from 'vite';

type DemoModule = typeof import('../src/lib/demo/sample');

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(ROOT, 'docs/screenshots');
const PORT = 8097;
const BASE = `http://127.0.0.1:${PORT}`;
// Monday 23 November 2026, 6:30 pm in New York: the sample ends the day before.
const TODAY = '2026-11-23';
const NOW = new Date(`${TODAY}T18:30:00-05:00`);
const SAMPLE_END = '2026-11-22';
const SUPERUSER = { email: 'screenshots@example.test', password: 'screenshots-superuser-password' };
const USER = { email: 'demo@example.test', password: 'demo-user-password' };

// The iPhone 15's full screen height (the device preset is Safari's visible area), at 2× to keep the files small.
const PHONE: BrowserContextOptions = { ...devices['iPhone 15'], viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 };
const DESKTOP: BrowserContextOptions = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 };

/** Starts PocketBase on a temp folder; returns a stop function. */
async function startPocketBase(): Promise<() => void> {
  const dir = mkdtempSync(path.join(tmpdir(), 'screenshots-pb-'));
  const flags = ['--dir', dir, '--migrationsDir', path.join(ROOT, 'pb_migrations'), '--hooksDir', path.join(ROOT, 'pb_hooks'), '--automigrate=false', '--hooksWatch=false'];
  const bin = path.join(ROOT, 'pocketbase');
  const upsert = spawnSync(bin, ['superuser', 'upsert', SUPERUSER.email, SUPERUSER.password, ...flags]);
  if (upsert.status !== 0) throw new Error(`Couldn't create the superuser. Run npm run pb:setup first.\n${upsert.stderr}`);
  const server = spawn(bin, ['serve', '--http', `127.0.0.1:${PORT}`, '--publicDir', path.join(ROOT, 'pb_public'), ...flags], { stdio: 'ignore' });
  const stop = () => {
    server.kill();
    rmSync(dir, { recursive: true, force: true });
  };
  for (let i = 0; i < 60; i++) {
    if (await fetch(`${BASE}/api/health`).then((r) => r.ok, () => false)) return stop;
    await new Promise((r) => setTimeout(r, 250));
  }
  stop();
  throw new Error(`PocketBase didn't start on port ${PORT}.`);
}

/** A PocketBase REST call; throws with the response on failure. */
async function api<T>(method: string, url: string, token: string | null, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

const signInApi = async (collection: string, who: { email: string; password: string }) =>
  (await api<{ token: string; record: { id: string } }>('POST', `/api/collections/${collection}/auth-with-password`, null, { identity: who.email, password: who.password }));

/** A fresh page with the frozen clock, signed in through the real form. */
async function signedInPage(browser: Browser, options: BrowserContextOptions): Promise<Page> {
  const context = await browser.newContext({ ...options, baseURL: BASE, timezoneId: 'America/New_York', colorScheme: 'light' });
  const page = await context.newPage();
  await page.clock.setFixedTime(NOW);
  await page.goto('/');
  await page.getByLabel('Email').fill(USER.email);
  await page.getByLabel('Password').fill(USER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('navigation', { name: 'Main' }).waitFor();
  return page;
}

async function shoot(page: Page, name: string) {
  // Keep the pointer off the charts, so no tooltip shows.
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(OUT, `${name}.png`), animations: 'disabled' });
  console.log(`  docs/screenshots/${name}.png`);
}

async function showHistory(page: Page, exercise: string) {
  await page.goto('/#/history');
  await page.getByLabel('Exercise').selectOption({ label: exercise });
  await page.getByRole('heading', { name: exercise, exact: true }).first().waitFor();
}

type Slot = { weight: number | null; reps: number | null; done: boolean };

/** Monday's workout in progress: squats under way, the rest planned from last time (not done yet). */
async function seedTodaysWorkout(userToken: string, userId: string, demo: DemoModule): Promise<string> {
  const exercises = await api<{ items: { id: string; name: string }[] }>('GET', '/api/collections/exercises/records?perPage=50', userToken);
  const id = (name: string) => exercises.items.find((e) => e.name === name)!.id;
  // Last time's sets for each lift, from the sample itself.
  const sessions = demo.demoSessions({ end: SAMPLE_END });
  const lastTime = (name: string) => sessions.filter((s) => s.exercise === name).at(-1)!.sets.map((s) => ({ ...s }) as Slot);

  // Squats: 5 lb more than last time; the ramp and two working sets done.
  const squat = lastTime('Back squat').map((s) => (s.weight !== null && s.weight >= 200 ? { ...s, weight: s.weight + 5, reps: 5 } : s));
  let working = 0;
  for (const s of squat) {
    if (s.weight === null) continue;
    const isWork = s.weight >= 200;
    s.done = !isWork || ++working <= 2;
  }
  const planned = (name: string) => lastTime(name).map((s) => ({ ...s, done: false }));

  const workout = await api<{ id: string }>('POST', '/api/collections/workouts/records', userToken, { user: userId, date: TODAY, status: 'draft' });
  const entries: [string, Slot[]][] = [
    ['Back squat', squat],
    ['Bench press', planned('Bench press')],
    ['Barbell row', planned('Barbell row')],
    ['Dumbbell curl', planned('Dumbbell curl')],
  ];
  for (const [position, [name, sets]] of entries.entries()) {
    await api('POST', '/api/collections/entries/records', userToken, { user: userId, workout: workout.id, exercise: id(name), position, sets });
  }
  return workout.id;
}

async function main() {
  const { module: demo } = await runnerImport<DemoModule>(path.join(ROOT, 'src/lib/demo/sample.ts'), { configFile: false, logLevel: 'silent' });
  const stop = await startPocketBase();
  const work = mkdtempSync(path.join(tmpdir(), 'screenshots-'));
  const browsers: Browser[] = [];
  try {
    const su = await signInApi('_superusers', SUPERUSER);
    await api('POST', '/api/collections/users/records', su.token, { email: USER.email, password: USER.password, passwordConfirm: USER.password, demo: true });

    const phoneBrowser = await webkit.launch();
    browsers.push(phoneBrowser);
    const phone = await signedInPage(phoneBrowser, PHONE);

    // The sample, through the real import.
    const sample = path.join(work, 'demo-sample.csv');
    writeFileSync(sample, demo.demoSampleCsv({ end: SAMPLE_END }));
    await phone.goto('/#/settings');
    await phone.getByLabel('Import CSV').setInputFiles(sample);
    await phone.getByTestId('import-preview').getByRole('button', { name: /^Import \d+ entr/ }).click();
    await phone.getByTestId('import-result').waitFor({ timeout: 120_000 });

    const user = await signInApi('users', USER);
    const workoutId = await seedTodaysWorkout(user.token, user.record.id, demo);

    console.log('Screenshots:');
    await phone.goto(`/#/workout/${workoutId}`);
    await phone.getByRole('tab', { name: 'Back squat' }).waitFor();
    await shoot(phone, 'log');
    await showHistory(phone, 'Back squat');
    await shoot(phone, 'history-lift');
    await showHistory(phone, 'All exercises');
    await shoot(phone, 'history-all');

    const desktopBrowser = await chromium.launch();
    browsers.push(desktopBrowser);
    const desktop = await signedInPage(desktopBrowser, DESKTOP);
    await showHistory(desktop, 'Back squat');
    await shoot(desktop, 'desktop-history');
  } finally {
    for (const b of browsers) await b.close();
    stop();
    rmSync(work, { recursive: true, force: true });
  }
}

await main();
