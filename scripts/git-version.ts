import { execFileSync } from 'node:child_process';
import type { GitInfo } from '../src/lib/version.ts';

/**
 * Reads the commit count, short hash and dirty state of the git repo at
 * `cwd`, for the build-time version stamp. Returns null when it can't give a
 * trustworthy answer: not a git checkout, git not installed, no commits yet,
 * or a shallow clone (whose commit count would be wrong; CI fetches full
 * history for this reason).
 */
export function readGitInfo(cwd: string): GitInfo | null {
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    if (git('rev-parse', '--is-shallow-repository') === 'true') {
      console.warn('git-version: shallow clone, so the commit count is unknown. Fetch full history.');
      return null;
    }
    return {
      count: Number(git('rev-list', '--count', 'HEAD')),
      hash: git('rev-parse', '--short', 'HEAD'),
      dirty: git('status', '--porcelain') !== '',
    };
  } catch {
    return null;
  }
}
