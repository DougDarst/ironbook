import { describe, expect, it } from 'vitest';
import {
  canBeDone,
  heavierThanAbove,
  mergeRemote,
  nextField,
  parseReps,
  parseWeight,
  toText,
  toggledDone,
  untickedCount,
  withField,
} from './entry';
import { emptySets, type SetSlot } from './model/sets';

const ok = (value: number | null) => ({ ok: true, value });

describe('parseWeight', () => {
  it('reads whole and decimal pounds', () => {
    expect(parseWeight('225')).toEqual(ok(225));
    expect(parseWeight('2.5')).toEqual(ok(2.5));
    expect(parseWeight('1.25')).toEqual(ok(1.25));
    expect(parseWeight('.5')).toEqual(ok(0.5));
    expect(parseWeight('45.')).toEqual(ok(45));
    expect(parseWeight(' 135 ')).toEqual(ok(135));
    expect(parseWeight('0')).toEqual(ok(0)); // bodyweight
  });

  it('accepts a decimal comma', () => {
    expect(parseWeight('2,5')).toEqual(ok(2.5));
  });

  it('treats empty as no weight', () => {
    expect(parseWeight('')).toEqual(ok(null));
    expect(parseWeight('   ')).toEqual(ok(null));
  });

  it('refuses anything else, saying why', () => {
    expect(parseWeight('abc')).toMatchObject({ ok: false, message: 'Weight must be a number.' });
    expect(parseWeight('-5')).toMatchObject({ ok: false });
    expect(parseWeight('1.2.3')).toMatchObject({ ok: false });
    expect(parseWeight('1e3')).toMatchObject({ ok: false });
    expect(parseWeight('2000')).toEqual(ok(2000));
    expect(parseWeight('2000.01')).toMatchObject({ ok: false, message: 'Weight can be at most 2000 lbs.' });
    expect(parseWeight('1.125')).toMatchObject({ ok: false, message: 'Weight can have at most 2 decimals.' });
  });
});

describe('parseReps', () => {
  it('reads whole numbers 0–999', () => {
    expect(parseReps('8')).toEqual(ok(8));
    expect(parseReps('0')).toEqual(ok(0));
    expect(parseReps('999')).toEqual(ok(999));
    expect(parseReps('')).toEqual(ok(null));
  });

  it('refuses decimals, signs and too many', () => {
    expect(parseReps('8.5')).toMatchObject({ ok: false, message: 'Reps must be a whole number.' });
    expect(parseReps('-1')).toMatchObject({ ok: false });
    expect(parseReps('1000')).toMatchObject({ ok: false, message: 'Reps can be at most 999.' });
  });
});

describe('toText', () => {
  it('shows numbers plainly and nothing for empty', () => {
    expect(toText(225)).toBe('225');
    expect(toText(2.5)).toBe('2.5');
    expect(toText(0)).toBe('0');
    expect(toText(null)).toBe('');
  });

  it('round-trips through the parsers', () => {
    for (const w of [0, 2.5, 1.25, 102.35, 2000]) expect(parseWeight(toText(w))).toEqual(ok(w));
  });
});

describe('done rules', () => {
  const full: SetSlot = { weight: 100, reps: 5, done: false };

  it('needs both numbers', () => {
    expect(canBeDone(full)).toBe(true);
    expect(canBeDone({ ...full, weight: null })).toBe(false);
    expect(canBeDone({ ...full, reps: null })).toBe(false);
  });

  it('toggles a complete slot, and leaves an incomplete one alone', () => {
    expect(toggledDone(full).done).toBe(true);
    expect(toggledDone({ ...full, done: true }).done).toBe(false);
    expect(toggledDone({ ...full, reps: null })).toEqual({ ...full, reps: null });
  });

  it('un-ticks a done slot when a number is cleared', () => {
    expect(withField({ ...full, done: true }, 'weight', null)).toEqual({ weight: null, reps: 5, done: false });
    expect(withField({ ...full, done: true }, 'reps', 6)).toEqual({ weight: 100, reps: 6, done: true });
  });

  it('does not change the original slot', () => {
    const slot = { ...full };
    withField(slot, 'weight', 200);
    toggledDone(slot);
    expect(slot).toEqual(full);
  });
});

describe('mergeRemote', () => {
  it('takes the remote slots except the ones kept locally', () => {
    const local = emptySets();
    local[0] = { weight: 100, reps: 5, done: true }; // unsaved here
    local[1] = { weight: 110, reps: 5, done: false };
    const remote = emptySets();
    remote[0] = { weight: 999, reps: 1, done: false };
    remote[1] = { weight: 120, reps: 6, done: true };
    remote[5] = { weight: 50, reps: 10, done: false };

    const merged = mergeRemote(local, remote, (i) => i === 0);
    expect(merged[0]).toEqual({ weight: 100, reps: 5, done: true });
    expect(merged[1]).toEqual({ weight: 120, reps: 6, done: true });
    expect(merged[5]).toEqual({ weight: 50, reps: 10, done: false });
    expect(merged).toHaveLength(20);
  });

  it('copies remote slots (no shared objects)', () => {
    const remote = emptySets();
    const merged = mergeRemote(emptySets(), remote, () => false);
    merged[0]!.weight = 5;
    expect(remote[0]!.weight).toBeNull();
  });
});

describe('nextField', () => {
  it('goes weight → reps → next set, and stops after the last', () => {
    expect(nextField(0, 'weight', 20)).toEqual({ slot: 0, field: 'reps' });
    expect(nextField(0, 'reps', 20)).toEqual({ slot: 1, field: 'weight' });
    expect(nextField(19, 'weight', 20)).toEqual({ slot: 19, field: 'reps' });
    expect(nextField(19, 'reps', 20)).toBeNull();
  });
});

describe('untickedCount', () => {
  it('counts sets with both numbers that are not done', () => {
    const sets = emptySets();
    sets[0] = { weight: 100, reps: 5, done: true };
    sets[1] = { weight: 100, reps: 5, done: false }; // counts
    sets[2] = { weight: 0, reps: 12, done: false }; // counts (bodyweight)
    sets[3] = { weight: 100, reps: null, done: false }; // incomplete: doesn't
    expect(untickedCount(sets)).toBe(2);
    expect(untickedCount(emptySets())).toBe(0);
  });
});

describe('heavierThanAbove', () => {
  const slot = (weight: number | null, reps: number | null = 5, done = false) => ({ weight, reps, done });

  it('marks a weight heavier than the set just above; never set 1', () => {
    expect(heavierThanAbove([slot(45), slot(55), slot(55), slot(50), slot(65)])).toEqual([false, true, false, false, true]);
  });

  it('compares with the nearest set above that has a weight, skipping empty ones', () => {
    expect(heavierThanAbove([slot(100), slot(null, null), slot(null, 8), slot(110), slot(null, null), slot(105)])).toEqual([
      false,
      false,
      false,
      true, // 110 vs 100, two empty sets up
      false,
      false, // 105 vs 110: lighter
    ]);
  });

  it('marks nothing before the first weight, and works whether or not sets are done', () => {
    expect(heavierThanAbove([slot(null, null), slot(135, 5, true), slot(185, 3, true)])).toEqual([false, false, true]);
    expect(heavierThanAbove([])).toEqual([]);
  });

  it('compares decimals exactly', () => {
    expect(heavierThanAbove([slot(102.5), slot(102.5), slot(102.75)])).toEqual([false, false, true]);
  });
});
