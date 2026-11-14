import { describe, expect, it } from 'vitest';
import { formatVersion } from './version';

describe('formatVersion', () => {
  it('formats major.minor.count and the short hash', () => {
    expect(formatVersion({ major: 1, minor: 2 }, { count: 47, hash: 'a3f9c1e', dirty: false })).toBe(
      'v1.2.47 (a3f9c1e)',
    );
  });

  it('marks a build with uncommitted changes', () => {
    expect(formatVersion({ major: 0, minor: 1 }, { count: 3, hash: 'bf2e70d', dirty: true })).toBe(
      'v0.1.3 (bf2e70d-dirty)',
    );
  });

  it('keeps zeros and multi-digit numbers as they are', () => {
    expect(formatVersion({ major: 0, minor: 10 }, { count: 1205, hash: '0000abc', dirty: false })).toBe(
      'v0.10.1205 (0000abc)',
    );
  });

  it('shows an unknown build when git info is missing', () => {
    expect(formatVersion({ major: 0, minor: 1 }, null)).toBe('v0.1 (unknown)');
  });
});
