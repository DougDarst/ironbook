import { describe, expect, it } from 'vitest';
import { buildHistory, monthLabel, sheetDate, type HistoryRow, type HistorySession } from './history';
import { emptySets, type SetSlot } from './model/sets';

function sets(...filled: Partial<SetSlot>[]): SetSlot[] {
  return emptySets().map((slot, i) => ({ ...slot, ...(filled[i] ?? {}) }));
}
const done = (weight: number, reps: number) => ({ weight, reps, done: true });

function session(exercise: string, date: string, s: SetSlot[], status: 'draft' | 'finished' = 'finished'): HistorySession {
  return { exercise, date, sets: s, status, workout: `w-${date}` };
}

const bench = { id: 'bench', name: 'Barbell Bench Press' };
const ohp = { id: 'ohp', name: 'barbell OHP' };
const curl = { id: 'curl', name: 'Curl' };

describe('sheetDate / monthLabel', () => {
  it('formats like the sheet', () => {
    expect(sheetDate('2026-09-01')).toBe('9/1/26');
    expect(sheetDate('2026-11-13')).toBe('11/13/26');
    expect(sheetDate('2009-01-05')).toBe('1/5/09');
    expect(monthLabel('2026-09')).toBe('September 2026');
  });
});

describe('buildHistory', () => {
  const data = [
    session('bench', '2026-10-01', sets(done(100, 10))),
    session('bench', '2026-09-08', sets(done(100, 8))),
    session('bench', '2026-09-22', sets(done(100, 9))),
    session('bench', '2026-11-03', sets(done(200, 10)), 'draft'),
    session('ohp', '2026-09-10', sets(done(60, 10))),
  ];

  it('makes one section per exercise with sessions, alphabetical ignoring case', () => {
    const sections = buildHistory(data, [ohp, curl, bench]);
    expect(sections.map((s) => s.exercise.name)).toEqual(['Barbell Bench Press', 'barbell OHP']); // Curl has none
  });

  it('lists finished sessions oldest first, with a divider at each new month', () => {
    const [section] = buildHistory(data, [bench]);
    expect(section!.rows.map((r) => (r.kind === 'month' ? `month ${r.month}` : r.date))).toEqual([
      'month 2026-09',
      '2026-09-08',
      '2026-09-22',
      'month 2026-10',
      '2026-10-01',
    ]); // the November draft is left out
  });

  it('carries volume, change and PRs from the calc module', () => {
    const rows = buildHistory(data, [bench])[0]!.rows.filter((r): r is HistoryRow => r.kind === 'session');
    expect(rows.map((r) => [r.volume, r.change?.amount ?? null, r.isPR])).toEqual([
      [800, null, true],
      [900, 100, true],
      [1000, 100, true],
    ]);
  });

  it('shows done sets as lbs×reps and keeps set positions', () => {
    const s = sets(done(45, 10), done(55.5, 8), { weight: 65, reps: 6, done: false }, done(75, 4));
    const row = buildHistory([session('bench', '2026-09-01', s)], [bench])[0]!.rows[1] as HistoryRow;
    expect(row.cells.slice(0, 5)).toEqual(['45×10', '55.5×8', null, '75×4', null]);
    expect(row.cells).toHaveLength(20);
    expect(row.workout).toBe('w-2026-09-01');
  });

  it('filters to one exercise when given one', () => {
    expect(buildHistory(data, [ohp]).map((s) => s.exercise.id)).toEqual(['ohp']);
  });

  it('is empty without finished sessions', () => {
    expect(buildHistory([], [bench, ohp])).toEqual([]);
    expect(buildHistory([session('bench', '2026-09-01', sets(done(1, 1)), 'draft')], [bench])).toEqual([]);
  });
});
