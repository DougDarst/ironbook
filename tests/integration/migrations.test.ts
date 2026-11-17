import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import PocketBase from 'pocketbase';
import { afterAll, describe, expect, it } from 'vitest';

// The migrations run down as cleanly as they run up: a database migrated
// up, all the way down and up again ends with the same schema, and all the
// way down it matches a fresh PocketBase. A broken "down" would otherwise
// only show up when a rollback is needed. Each step uses its own throwaway
// database; the shared test servers aren't touched.

const ROOT = path.resolve(import.meta.dirname, '../..');
const BIN = path.join(ROOT, 'pocketbase');
const MIGRATIONS = path.join(ROOT, 'pb_migrations');
const COUNT = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.js')).length;
const ADMIN = { email: 'migrations@example.test', password: 'migrations-password' };

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

function freshDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'pb-migrations-'));
  dirs.push(dir);
  return dir;
}

function migrate(dataDir: string, migrationsDir: string, ...args: string[]): void {
  execFileSync(BIN, ['migrate', ...args, '--dir', dataDir, '--migrationsDir', migrationsDir, '--automigrate=false'], {
    input: 'y\n', // "down" asks for confirmation
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

/**
 * The database's schema: every collection (fields, rules, indexes, auth
 * options) and the rate-limit settings, read through a short-lived server.
 * Random ids and timestamps are replaced, so two databases compare equal
 * when their schemas are the same.
 */
async function schema(dataDir: string, migrationsDir: string): Promise<unknown> {
  execFileSync(BIN, ['superuser', 'upsert', ADMIN.email, ADMIN.password, '--dir', dataDir, '--migrationsDir', migrationsDir]);
  const port = await freePort();
  const server = spawn(
    BIN,
    ['serve', '--http', `127.0.0.1:${port}`, '--dir', dataDir, '--migrationsDir', migrationsDir],
    { stdio: 'ignore' },
  );
  try {
    const url = `http://127.0.0.1:${port}`;
    for (let i = 0; ; i++) {
      try {
        if ((await fetch(`${url}/api/health`)).ok) break;
      } catch {
        if (i > 150) throw new Error('PocketBase did not start');
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    const pb = new PocketBase(url);
    await pb.collection('_superusers').authWithPassword(ADMIN.email, ADMIN.password);
    const collections = (await pb.collections.getFullList()).filter((c) => c.name !== '_superusers');
    const settings = await pb.settings.getAll();

    // Collection ids are random for collections the migrations create:
    // refer to collections by name instead.
    let text = JSON.stringify({ collections, rateLimits: settings.rateLimits });
    for (const c of collections) text = text.replaceAll(c.id, `<${c.name}>`);
    return JSON.parse(text, (key, value) => {
      if (key === 'created' || key === 'updated') return undefined;
      // Field ids are random too; fields are matched by name.
      if (key === 'id' && typeof value === 'string' && !value.startsWith('<')) return undefined;
      return value;
    });
  } finally {
    server.kill();
  }
}

describe('migrations', () => {
  it(`all ${COUNT} run down to a fresh database and back up to the same schema`, async () => {
    const empty = freshDir(); // a migrations folder with nothing in it
    const pristineDir = freshDir();
    migrate(pristineDir, empty, 'up');
    const pristine = await schema(pristineDir, empty);

    const dir = freshDir();
    migrate(dir, MIGRATIONS, 'up');
    const up = await schema(dir, MIGRATIONS);
    expect(JSON.stringify(up)).toContain('<entries>'); // really migrated

    migrate(dir, MIGRATIONS, 'down', String(COUNT));
    expect(await schema(dir, empty)).toEqual(pristine);

    migrate(dir, MIGRATIONS, 'up');
    expect(await schema(dir, MIGRATIONS)).toEqual(up);
  }, 120_000);
});
