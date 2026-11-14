import { spawnSync, execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Tests for scripts/deploy.sh's safety checks. Nothing here can reach a
// server: the host is under .invalid (never resolves), and the git tests run
// a copy of the script in a throwaway repo with a fake `npm` that stops it
// right after the checks, before any build or upload.

const SCRIPT = path.resolve(import.meta.dirname, 'deploy.sh');
const SAFE_ENV = [
  'DEPLOY_HOST=nobody@deploy-test.invalid',
  'DEPLOY_PATH=/opt/ironbook-test',
  'DEPLOY_SERVICE=ironbook-test',
  'DEPLOY_PORT=8092',
];

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(path.join(tmpdir(), 'deploy-test-'));
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

function writeEnv(lines: string[]): string {
  const file = path.join(tmp, '.env');
  writeFileSync(file, lines.join('\n') + '\n');
  return file;
}

function run(script: string, args: string[], env: Record<string, string> = {}) {
  const res = spawnSync('bash', [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: 20_000,
  });
  return { code: res.status, output: `${res.stdout}${res.stderr}` };
}

describe('deploy.sh refuses pb_data', () => {
  for (const arg of ['pb_data', './pb_data/', '--include=pb_data', '--upload-pb_data']) {
    it(`refuses the argument '${arg}'`, () => {
      const { code, output } = run(SCRIPT, [arg], { DEPLOY_ENV_FILE: writeEnv(SAFE_ENV) });
      expect(code).toBe(2);
      expect(output).toContain('REFUSED');
      expect(output).toContain('never uploads, overwrites or deletes pb_data');
    });
  }

  it('refuses even alongside valid flags', () => {
    const { code } = run(SCRIPT, ['--dry-run', 'pb_data'], { DEPLOY_ENV_FILE: writeEnv(SAFE_ENV) });
    expect(code).toBe(2);
  });

  it('refuses a DEPLOY_PATH inside pb_data', () => {
    const env = writeEnv([...SAFE_ENV, 'DEPLOY_PATH=/opt/ironbook/pb_data']);
    const { code, output } = run(SCRIPT, [], { DEPLOY_ENV_FILE: env });
    expect(code).toBe(2);
    expect(output).toContain('points into pb_data');
  });
});

describe('deploy.sh validates its settings', () => {
  it('refuses unknown arguments', () => {
    const { code, output } = run(SCRIPT, ['--force'], { DEPLOY_ENV_FILE: writeEnv(SAFE_ENV) });
    expect(code).toBe(2);
    expect(output).toContain("unknown argument '--force'");
  });

  it('requires the .env file', () => {
    const { code, output } = run(SCRIPT, [], { DEPLOY_ENV_FILE: path.join(tmp, 'missing.env') });
    expect(code).toBe(1);
    expect(output).toContain('Copy .env.example to .env');
  });

  it('rejects the placeholder host', () => {
    const env = writeEnv(['DEPLOY_HOST=you@your-server', 'DEPLOY_PATH=/opt/ironbook']);
    const { code, output } = run(SCRIPT, [], { DEPLOY_ENV_FILE: env });
    expect(code).toBe(1);
    expect(output).toContain('placeholder');
  });

  for (const [value, message] of [
    ['', 'DEPLOY_PATH is not set'],
    ['/', 'DEPLOY_PATH is not set'],
    ['opt/ironbook', 'must be an absolute path'],
    ['/opt/my app', 'must be an absolute path'],
    ['/opt/ironbook/../etc', "must not contain '..'"],
  ] as const) {
    it(`rejects DEPLOY_PATH='${value}'`, () => {
      const env = writeEnv([...SAFE_ENV, `DEPLOY_PATH=${value}`]);
      const { code, output } = run(SCRIPT, [], { DEPLOY_ENV_FILE: env });
      expect(code).toBe(1);
      expect(output).toContain(message);
    });
  }

  it('rejects a service name that could inject a command', () => {
    const env = writeEnv([...SAFE_ENV, "DEPLOY_SERVICE=ironbook'; rm -rf ~; '"]);
    const { code, output } = run(SCRIPT, [], { DEPLOY_ENV_FILE: env });
    expect(code).toBe(1);
    expect(output).toContain('not a valid service name');
  });
});

describe('deploy.sh git checks', () => {
  let repo: string;
  let env: Record<string, string>;
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.test', '-c', 'commit.gpgsign=false', ...args], {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();

  beforeEach(() => {
    // A bare "origin", and a clone with the deploy script committed on main.
    const origin = path.join(tmp, 'origin.git');
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
    repo = path.join(tmp, 'repo');
    execFileSync('git', ['clone', '-q', origin, repo], { stdio: 'ignore' });
    // Name the unborn branch main, whatever git's default branch name is.
    git('symbolic-ref', 'HEAD', 'refs/heads/main');
    mkdirSync(path.join(repo, 'scripts'));
    copyFileSync(SCRIPT, path.join(repo, 'scripts/deploy.sh'));
    copyFileSync(path.join(path.dirname(SCRIPT), 'deploy-upload.sh'), path.join(repo, 'scripts/deploy-upload.sh'));
    writeFileSync(path.join(repo, '.gitignore'), '.env\n');
    git('add', '.');
    git('commit', '-q', '-m', 'init');
    git('push', '-q', '-u', 'origin', 'main');

    // A fake npm: if the checks pass, the script stops at the build step.
    const bin = path.join(tmp, 'bin');
    mkdirSync(bin);
    writeFileSync(path.join(bin, 'npm'), '#!/bin/sh\necho "fake npm: stop"\nexit 97\n');
    chmodSync(path.join(bin, 'npm'), 0o755);
    env = { DEPLOY_ENV_FILE: writeEnv(SAFE_ENV), PATH: `${bin}:${process.env.PATH}` };
  });

  const deploy = (...args: string[]) => run(path.join(repo, 'scripts/deploy.sh'), args, env);

  it('passes on a clean main in sync with origin, then builds', () => {
    const { code, output } = deploy();
    expect(output).toContain('git checks passed');
    expect(output).toContain('fake npm: stop');
    expect(code).toBe(97);
  });

  it('refuses a dirty working tree', () => {
    writeFileSync(path.join(repo, 'untracked.txt'), 'x');
    const { code, output } = deploy();
    expect(code).toBe(2);
    expect(output).toContain('uncommitted changes');
  });

  it('refuses a dirty tree even with --allow-branch', () => {
    writeFileSync(path.join(repo, '.gitignore'), '.env\nchanged\n');
    const { code, output } = deploy('--allow-branch');
    expect(code).toBe(2);
    expect(output).toContain('uncommitted changes');
  });

  it('refuses another branch unless --allow-branch is given', () => {
    git('checkout', '-q', '-b', 'story/test');
    const refused = deploy();
    expect(refused.code).toBe(2);
    expect(refused.output).toContain("on branch 'story/test'");

    const allowed = deploy('--allow-branch');
    expect(allowed.output).toContain("--allow-branch: deploying 'story/test'");
    expect(allowed.output).toContain('git checks passed');
    expect(allowed.code).toBe(97);
  });

  it('refuses main when it has commits not on origin/main', () => {
    writeFileSync(path.join(repo, 'new.txt'), 'x');
    git('add', '.');
    git('commit', '-q', '-m', 'local only');
    const { code, output } = deploy();
    expect(code).toBe(2);
    expect(output).toContain('differs from origin/main');
  });
});
