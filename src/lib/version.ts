/**
 * The app's version label, e.g. "v0.1.47 (a3f9c1e)".
 *
 * - major.minor: set by hand in VERSION (src/lib/config.ts)
 * - patch: the number of commits on the built branch (`git rev-list --count HEAD`)
 * - in parentheses: the short commit hash, with "-dirty" if the build had
 *   uncommitted changes
 *
 * The git part is read at build time (scripts/git-version.ts) and stamped
 * into the bundle as __APP_VERSION__ by vite.config.ts (see app-version.ts).
 * This module stays pure so the build config and Node tests can import it.
 */

export interface GitInfo {
  /** Commits reachable from HEAD. */
  count: number;
  /** Short commit hash of HEAD. */
  hash: string;
  /** True if the working tree had uncommitted changes. */
  dirty: boolean;
}

/** Formats the version label. Without git info (e.g. built outside a clone), the build is "unknown". */
export function formatVersion(version: { major: number; minor: number }, git: GitInfo | null): string {
  const base = `v${version.major}.${version.minor}`;
  if (!git) return `${base} (unknown)`;
  return `${base}.${git.count} (${git.hash}${git.dirty ? '-dirty' : ''})`;
}
