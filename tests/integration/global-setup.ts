import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import PocketBase from 'pocketbase';
import type { TestProject } from 'vitest/node';
import { relaxRateLimits } from '../support/rate-limits';

/**
 * Starts one PocketBase for the integration tests: a throwaway database in a
 * temp folder, with this repo's migrations and hooks, on a free port. It
 * never touches the local pb_data/.
 */

const ROOT = path.resolve(import.meta.dirname, '../..');
const BIN = path.join(ROOT, 'pocketbase');
const SUPERUSER = { email: 'superuser@example.test', password: 'superuser-password' };

declare module 'vitest' {
  export interface ProvidedContext {
    pbUrl: string;
    /** A server with production rate limits (see limits.test.ts). */
    pbStrictUrl: string;
    superuser: { email: string; password: string };
    /** Rate-limit settings as the migrations left them, before tests relax them. */
    migratedRateLimits: { enabled: boolean; rules: { label: string; duration: number; maxRequests: number }[] };
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

async function waitForHealth(url: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${url}/api/health`)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`PocketBase did not become healthy at ${url}`);
}

/** A running test PocketBase: its URL, and a function that stops it. */
interface TestServer {
  url: string;
  stop: () => void;
}

/** Starts PocketBase on a throwaway database, with this repo's migrations and hooks. */
async function startServer(): Promise<TestServer> {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'pb-test-'));
  const dirs = [
    '--dir', dataDir,
    '--migrationsDir', path.join(ROOT, 'pb_migrations'),
    '--hooksDir', path.join(ROOT, 'pb_hooks'),
    // Never write migration files when tests change collections.
    '--automigrate=false',
  ];
  // Serve-only flags: don't restart if a hook file changes mid-run.
  const serveFlags = ['--hooksWatch=false'];
  execFileSync(BIN, ['superuser', 'upsert', SUPERUSER.email, SUPERUSER.password, ...dirs]);

  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const server = spawn(BIN, ['serve', '--http', `127.0.0.1:${port}`, ...dirs, ...serveFlags], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  server.stdout.on('data', (d) => (output += d));
  server.stderr.on('data', (d) => (output += d));

  // If PocketBase dies during the run, show why (tests would only see
  // "connection refused").
  let stopping = false;
  server.on('exit', (code, signal) => {
    if (!stopping) console.error(`\nPocketBase exited unexpectedly (${code ?? signal}). Its output:\n${output}`);
  });

  try {
    await waitForHealth(url);
  } catch (err) {
    server.kill();
    throw new Error(`${(err as Error).message}\n${output}`);
  }

  return {
    url,
    stop: () => {
      stopping = true;
      server.kill();
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

export default async function setup(project: TestProject) {
  if (!existsSync(BIN)) {
    throw new Error('PocketBase binary not found. Run `npm run pb:setup` first.');
  }

  // Two servers: the main one relaxes rate limits so parallel tests from
  // one IP aren't throttled; the "strict" one keeps the production limits
  // for limits.test.ts.
  const [main, strict] = await Promise.all([startServer(), startServer()]);

  // Read the migrated rate-limit settings (for auth.test.ts), then relax.
  const admin = new PocketBase(main.url);
  await admin.collection('_superusers').authWithPassword(SUPERUSER.email, SUPERUSER.password);
  const migrated = await admin.settings.getAll();
  await relaxRateLimits(admin);

  project.provide('pbUrl', main.url);
  project.provide('pbStrictUrl', strict.url);
  project.provide('migratedRateLimits', migrated.rateLimits);
  project.provide('superuser', SUPERUSER);

  return () => {
    main.stop();
    strict.stop();
  };
}
