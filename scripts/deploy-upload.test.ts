import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// The deploy's upload step (scripts/deploy-upload.sh), run for real with
// this machine's rsync (openrsync on macOS, GNU rsync in CI) against local
// folders standing in for the repo and the server.

const UPLOAD_SCRIPT = path.resolve(import.meta.dirname, 'deploy-upload.sh');

let tmp: string;
let repo: string;
let server: string;

/** Writes files given as {"relative/path": "content"} under `root`. */
function write(root: string, files: Record<string, string>) {
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  }
}

/** Every file under `root`, as {"relative/path": "content"}. */
function snapshot(root: string, dir = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of readdirSync(path.join(root, dir))) {
    const rel = path.join(dir, name);
    if (statSync(path.join(root, rel)).isDirectory()) Object.assign(out, snapshot(root, rel));
    else out[rel] = readFileSync(path.join(root, rel), 'utf8');
  }
  return out;
}

/** Runs bash with deploy-upload.sh sourced. */
function bash(script: string, ...args: string[]): string {
  return execFileSync('bash', ['-c', `source "$0"; ${script}`, UPLOAD_SCRIPT, ...args], { encoding: 'utf8' });
}

/** GNU rsync (CI, Linux) rather than Apple's openrsync (macOS). */
function isGnuRsync(): boolean {
  const version = execFileSync('rsync', ['--version'], { encoding: 'utf8' });
  return !/openrsync/i.test(version) && /rsync\s+version\s+3/.test(version);
}

const LIVE_DATA = {
  'pb_data/data.db': 'LIVE DATABASE',
  'pb_data/auxiliary.db': 'LIVE AUX',
  'pb_data/backups/nightly.zip': 'BACKUP',
};

beforeEach(() => {
  tmp = mkdtempSync(path.join(tmpdir(), 'deploy-upload-'));
  repo = path.join(tmp, 'repo');
  server = path.join(tmp, 'server');
  // The repo: a fresh build, plus a local sandbox pb_data that must never be sent.
  write(repo, {
    'pb_public/index.html': 'NEW INDEX',
    'pb_public/assets/app-new.js': 'NEW JS',
    'pb_hooks/logbook.pb.js': 'NEW HOOK',
    'pb_hooks/generated/shared.cjs': 'NEW SHARED',
    'pb_migrations/2_new.js': 'NEW MIGRATION',
    'pb_migrations/1_first.js': 'FIRST MIGRATION',
    'pb_data/data.db': 'LOCAL SANDBOX',
    'src/main.ts': 'SOURCE',
  });
  // The server: live data, the binary, an older build with stale files.
  write(server, {
    ...LIVE_DATA,
    pocketbase: 'BINARY',
    'pb_public/index.html': 'OLD INDEX',
    'pb_public/assets/app-old.js': 'STALE JS',
    'pb_hooks/removed.pb.js': 'STALE HOOK',
    'pb_migrations/1_first.js': 'FIRST MIGRATION',
  });
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe('deploy_upload', () => {
  it('replaces the three folders exactly, and touches nothing else', () => {
    bash('deploy_upload "$1" "$2"', repo, server);
    expect(snapshot(server)).toEqual({
      ...LIVE_DATA, // untouched; the local sandbox wasn't sent
      pocketbase: 'BINARY', // untouched
      'pb_public/index.html': 'NEW INDEX',
      'pb_public/assets/app-new.js': 'NEW JS', // stale app-old.js removed
      'pb_hooks/logbook.pb.js': 'NEW HOOK', // stale removed.pb.js removed
      'pb_hooks/generated/shared.cjs': 'NEW SHARED',
      'pb_migrations/1_first.js': 'FIRST MIGRATION',
      'pb_migrations/2_new.js': 'NEW MIGRATION',
    });
  });

  it('works into a first-time server folder that only has pb_data and the binary', () => {
    rmSync(server, { recursive: true });
    write(server, { ...LIVE_DATA, pocketbase: 'BINARY' });
    bash('deploy_upload "$1" "$2"', repo, server);
    const after = snapshot(server);
    expect(after['pb_data/data.db']).toBe('LIVE DATABASE');
    expect(after['pb_public/index.html']).toBe('NEW INDEX');
  });

  it('changes nothing on a dry run, but lists what would change', () => {
    const before = snapshot(server);
    const output = bash('deploy_upload "$1" "$2" 1', repo, server);
    expect(snapshot(server)).toEqual(before);
    expect(output).toMatch(/app-new\.js/);
    expect(output).toMatch(/app-old\.js/); // would be deleted
    expect(output).not.toMatch(/pb_data/);
  });

  it('accepts a destination with or without a trailing slash', () => {
    bash('deploy_upload "$1" "$2/"', repo, server);
    expect(snapshot(server)['pb_public/index.html']).toBe('NEW INDEX');
    expect(snapshot(server)['pb_data/data.db']).toBe('LIVE DATABASE');
  });
});

describe('the rsync safety flags alone', () => {
  // Layers 2 and 3: even if the source list were widened to the whole repo
  // by mistake, pb_data is neither sent (exclude) nor deleted (protect).
  it('keep the live pb_data even when syncing the whole repo with --delete', () => {
    bash('cd "$1" && rsync "${DEPLOY_RSYNC_FLAGS[@]}" . "$2/"', repo, server);
    const after = snapshot(server);
    for (const [file, content] of Object.entries(LIVE_DATA)) expect(after[file], file).toBe(content);
  });

  // Layer 3: rsync never deletes excluded files by itself, so "protect"
  // guards against a future edit adding --delete-excluded, which would.
  // Only GNU rsync honors it (CI, Linux); Apple's openrsync doesn't.
  it.skipIf(!isGnuRsync())('keep the live pb_data even if --delete-excluded were added (GNU rsync)', () => {
    bash('cd "$1" && rsync "${DEPLOY_RSYNC_FLAGS[@]}" --delete-excluded . "$2/"', repo, server);
    const after = snapshot(server);
    for (const [file, content] of Object.entries(LIVE_DATA)) expect(after[file], file).toBe(content);
  });
});
