import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readGitInfo } from './git-version';

// Runs against a real throwaway git repo, so it proves that a new commit
// gives a new number and hash.
describe('readGitInfo', () => {
  let dir: string;
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const commit = (file: string) => {
    writeFileSync(path.join(dir, file), file);
    git('add', file);
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.test', '-c', 'commit.gpgsign=false', 'commit', '-m', file);
  };

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'git-version-'));
    git('init', '-q');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('counts commits and changes the hash with each new commit', () => {
    commit('a.txt');
    const first = readGitInfo(dir);
    expect(first).toEqual({ count: 1, hash: git('rev-parse', '--short', 'HEAD'), dirty: false });

    commit('b.txt');
    const second = readGitInfo(dir);
    expect(second?.count).toBe(2);
    expect(second?.hash).not.toBe(first?.hash);
    expect(second?.dirty).toBe(false);
  });

  it('reports uncommitted and untracked changes as dirty', () => {
    commit('a.txt');
    writeFileSync(path.join(dir, 'a.txt'), 'changed');
    expect(readGitInfo(dir)?.dirty).toBe(true);

    git('checkout', '--', 'a.txt');
    expect(readGitInfo(dir)?.dirty).toBe(false);
    writeFileSync(path.join(dir, 'new.txt'), 'new');
    expect(readGitInfo(dir)?.dirty).toBe(true);
  });

  it('returns null without commits or outside a git repo', () => {
    expect(readGitInfo(dir)).toBeNull();
    const plain = mkdtempSync(path.join(tmpdir(), 'not-git-'));
    try {
      expect(readGitInfo(plain)).toBeNull();
    } finally {
      rmSync(plain, { recursive: true, force: true });
    }
  });
});
