import { describe, expect, it } from 'vitest';
import { emptySets, MAX_REPS, MAX_WEIGHT, SETS_PER_ENTRY, validateSets, type SetSlot } from './sets';

/** Twenty empty slots, with the given slots filled in from the start. */
function sets(...filled: Partial<SetSlot>[]): unknown[] {
  return emptySets().map((slot, i) => ({ ...slot, ...(filled[i] ?? {}) }));
}

describe('emptySets', () => {
  it('has exactly 20 independent empty slots', () => {
    const s = emptySets();
    expect(s).toHaveLength(SETS_PER_ENTRY);
    expect(s.every((x) => x.weight === null && x.reps === null && x.done === false)).toBe(true);
    s[0]!.weight = 100;
    expect(s[1]!.weight).toBeNull();
  });
});

describe('validateSets', () => {
  it('accepts empty, partial, and done slots', () => {
    expect(validateSets(emptySets())).toBeNull();
    expect(validateSets(sets({ weight: 225, reps: 5, done: true }, { weight: 2.5, reps: 0 }, { reps: 10 }))).toBeNull();
  });

  it('requires exactly 20 slots', () => {
    expect(validateSets(emptySets().slice(0, 19))).toMatch(/exactly 20/);
    expect(validateSets([...emptySets(), { weight: null, reps: null, done: false }])).toMatch(/exactly 20/);
    expect(validateSets({})).toMatch(/must be a list/);
    expect(validateSets(null)).toMatch(/must be a list/);
  });

  it('requires exactly weight, reps and done on each slot', () => {
    const extra = sets();
    extra[3] = { weight: null, reps: null, done: false, note: 'x' };
    expect(validateSets(extra)).toBe('Set 4 must have exactly weight, reps and done.');
    const missing = sets();
    missing[0] = { weight: null, reps: null };
    expect(validateSets(missing)).toBe('Set 1 must have exactly weight, reps and done.');
    const notObject = sets();
    notObject[1] = [1, 2, false];
    expect(validateSets(notObject)).toBe('Set 2 must be an object.');
  });

  it('allows weights 0 to 2000 with up to 2 decimals', () => {
    expect(validateSets(sets({ weight: 0 }))).toBeNull();
    expect(validateSets(sets({ weight: MAX_WEIGHT }))).toBeNull();
    expect(validateSets(sets({ weight: 1.25 }))).toBeNull();
    expect(validateSets(sets({ weight: 0.1 + 0.2 }))).toBeNull(); // 0.30000000000000004
    expect(validateSets(sets({ weight: -1 }))).toMatch(/0–2000/);
    expect(validateSets(sets({ weight: MAX_WEIGHT + 0.01 }))).toMatch(/0–2000/);
    expect(validateSets(sets({ weight: 1.125 }))).toMatch(/2 decimals/);
    expect(validateSets(sets({ weight: '225' as unknown as number }))).toMatch(/must be a number/);
    expect(validateSets(sets({ weight: Number.NaN }))).toMatch(/must be a number/);
  });

  it('allows whole reps 0 to 999', () => {
    expect(validateSets(sets({ reps: 0 }))).toBeNull();
    expect(validateSets(sets({ reps: MAX_REPS }))).toBeNull();
    expect(validateSets(sets({ reps: MAX_REPS + 1 }))).toMatch(/0–999/);
    expect(validateSets(sets({ reps: -1 }))).toMatch(/0–999/);
    expect(validateSets(sets({ reps: 5.5 }))).toMatch(/whole number/);
  });

  it('requires done to be a boolean', () => {
    expect(validateSets(sets({ done: 1 as unknown as boolean }))).toMatch(/true or false/);
  });

  it('refuses a done set without both weight and reps', () => {
    expect(validateSets(sets({ weight: 100, done: true }))).toBe('Set 1: a done set needs both weight and reps.');
    expect(validateSets(sets({}, { reps: 5, done: true }))).toBe('Set 2: a done set needs both weight and reps.');
    expect(validateSets(sets({ weight: 0, reps: 10, done: true }))).toBeNull(); // bodyweight
  });

  it('names the first bad slot, counting from 1', () => {
    const s = sets();
    s[19] = { weight: 5000, reps: 1, done: false };
    expect(validateSets(s)).toBe('Set 20: weight must be 0–2000 lbs.');
  });
});
