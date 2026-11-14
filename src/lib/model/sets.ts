/**
 * The 20 set slots of an entry, stored as one JSON array. Dependency-free:
 * also bundled into the PocketBase hooks, which validate every save.
 */

export const SETS_PER_ENTRY = 20;
export const MAX_WEIGHT = 2000; // lbs
export const MAX_REPS = 999;

/** One slot. Empty slots have null weight and reps, and aren't done. */
export interface SetSlot {
  weight: number | null;
  reps: number | null;
  done: boolean;
}

export function emptySet(): SetSlot {
  return { weight: null, reps: null, done: false };
}

/** Twenty empty slots: a new exercise's first entry. */
export function emptySets(): SetSlot[] {
  return Array.from({ length: SETS_PER_ENTRY }, emptySet);
}

/** At most 2 decimal places (2.5, 1.25), allowing for float noise. */
function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

/**
 * Checks a value against the sets shape. Returns null if valid, or a
 * message naming the first problem (slots are numbered from 1).
 */
export function validateSets(value: unknown): string | null {
  if (!Array.isArray(value)) return 'Sets must be a list.';
  if (value.length !== SETS_PER_ENTRY) return `Sets must have exactly ${SETS_PER_ENTRY} slots.`;
  for (let i = 0; i < value.length; i++) {
    const slot: unknown = value[i];
    const n = i + 1;
    if (typeof slot !== 'object' || slot === null || Array.isArray(slot)) return `Set ${n} must be an object.`;
    const keys = Object.keys(slot).sort().join(',');
    if (keys !== 'done,reps,weight') return `Set ${n} must have exactly weight, reps and done.`;
    const { weight, reps, done } = slot as Record<string, unknown>;
    if (weight !== null) {
      if (typeof weight !== 'number' || !Number.isFinite(weight)) return `Set ${n}: weight must be a number or empty.`;
      if (weight < 0 || weight > MAX_WEIGHT) return `Set ${n}: weight must be 0–${MAX_WEIGHT} lbs.`;
      if (!hasAtMostTwoDecimals(weight)) return `Set ${n}: weight can have at most 2 decimals.`;
    }
    if (reps !== null) {
      if (typeof reps !== 'number' || !Number.isInteger(reps)) return `Set ${n}: reps must be a whole number or empty.`;
      if (reps < 0 || reps > MAX_REPS) return `Set ${n}: reps must be 0–${MAX_REPS}.`;
    }
    if (typeof done !== 'boolean') return `Set ${n}: done must be true or false.`;
    if (done && (weight === null || reps === null)) return `Set ${n}: a done set needs both weight and reps.`;
  }
  return null;
}
