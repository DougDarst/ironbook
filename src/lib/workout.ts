/**
 * Helpers for starting and choosing workouts. Pure functions, unit-tested
 * in workout.test.ts.
 */
import { emptySets, type SetSlot } from './model/sets';

/**
 * The sets a new entry starts with: last time's weights and reps, none
 * done. With no last time (a new exercise), 20 empty slots.
 */
export function prefillSets(last: { sets: readonly SetSlot[] } | null): SetSlot[] {
  if (!last) return emptySets();
  return emptySets().map((slot, i) => {
    const previous = last.sets[i];
    return previous ? { weight: previous.weight, reps: previous.reps, done: false } : slot;
  });
}

/**
 * Whether an exercise name matches a search: every word of the query
 * appears in the name, ignoring case ("bench db" matches "DB Bench Press").
 */
export function matchesSearch(name: string, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = name.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * A new PocketBase record id (15 lowercase letters and digits). Creating
 * ids on the client lets one batch request create a workout and the
 * entries that point at it.
 */
export function newRecordId(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  // 252 is the largest multiple of 36 below 256: rejecting bytes above it
  // keeps every character equally likely.
  let id = '';
  while (id.length < 15) {
    for (const byte of random(15)) {
      if (byte < 252 && id.length < 15) id += ID_CHARS[byte % 36];
    }
  }
  return id;
}
