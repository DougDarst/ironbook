/**
 * Exercise names. Dependency-free: also bundled into the PocketBase hooks.
 */

export const MAX_EXERCISE_NAME = 100;

/**
 * The stored form of a name: trimmed, with runs of whitespace collapsed to
 * one space. Uniqueness ignores case on top of this (a database index).
 */
export function normalizeExerciseName(name: unknown): string {
  return String(name ?? '').trim().replace(/\s+/g, ' ');
}
