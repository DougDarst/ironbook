import { describe, expect, it } from 'vitest';
import { emptySets, type SetSlot } from './model/sets';
import { matchesSearch, newRecordId, prefillSets } from './workout';

describe('prefillSets', () => {
  it("copies last time's weights and reps, with nothing done", () => {
    const last = emptySets();
    last[0] = { weight: 135, reps: 10, done: true };
    last[1] = { weight: 155, reps: 8, done: false };
    last[2] = { weight: 175, reps: null, done: false };
    const sets = prefillSets({ sets: last });
    expect(sets.slice(0, 4)).toEqual([
      { weight: 135, reps: 10, done: false },
      { weight: 155, reps: 8, done: false },
      { weight: 175, reps: null, done: false },
      { weight: null, reps: null, done: false },
    ]);
    expect(sets).toHaveLength(20);
    expect(sets.every((s) => !s.done)).toBe(true);
  });

  it('does not share objects with last time', () => {
    const last: SetSlot[] = emptySets();
    last[0] = { weight: 100, reps: 5, done: true };
    const sets = prefillSets({ sets: last });
    sets[0]!.weight = 999;
    expect(last[0]!.weight).toBe(100);
  });

  it('starts a new exercise with 20 empty slots', () => {
    expect(prefillSets(null)).toEqual(emptySets());
  });
});

describe('matchesSearch', () => {
  it('matches every word anywhere, ignoring case', () => {
    expect(matchesSearch('DB Bench Press', 'bench db')).toBe(true);
    expect(matchesSearch('Barbell Bench Press', 'BENCH')).toBe(true);
    expect(matchesSearch('Barbell Bench Press', 'bench squat')).toBe(false);
  });

  it('matches everything for an empty search', () => {
    expect(matchesSearch('Squat', '')).toBe(true);
    expect(matchesSearch('Squat', '   ')).toBe(true);
  });
});

describe('newRecordId', () => {
  it('makes 15 lowercase letters and digits', () => {
    for (let i = 0; i < 50; i++) expect(newRecordId()).toMatch(/^[a-z0-9]{15}$/);
  });

  it('skips biased bytes (252–255)', () => {
    const bytes = [255, 254, 253, 252, ...Array.from({ length: 15 }, (_, i) => i)];
    let calls = 0;
    const id = newRecordId((n) => {
      calls += 1;
      return Uint8Array.from(bytes.splice(0, n));
    });
    expect(id).toBe('abcdefghijklmno');
    expect(calls).toBe(2);
  });
});
