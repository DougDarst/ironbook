import { describe, expect, it } from 'vitest';
import { buildHistory, cardCells, monthLabel, sheetDate, type HistoryRow, type HistorySession } from './history';
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

describe('cardCells', () => {
  const cells = (...filled: (string | null)[]) => [...filled, ...Array<null>(20 - filled.length).fill(null)];

  it('keeps whole rows of 5 up to the last done set', () => {
    expect(cardCells(cells('a', 'b'))).toEqual(['a', 'b', null, null, null]);
    expect(cardCells(cells('1', '2', '3', '4', '5'))).toHaveLength(5);
    expect(cardCells(cells('1', '2', '3', '4', '5', '6'))).toEqual(['1', '2', '3', '4', '5', '6', null, null, null, null]);
  });

  it('keeps positions: blanks before the last done set stay', () => {
    const c = cells(...Array<null>(11).fill(null), 'x');
    expect(cardCells(c)).toHaveLength(15);
    expect(cardCells(c)[11]).toBe('x');
    expect(cardCells(c).slice(0, 11)).toEqual(Array(11).fill(null));
  });

  it('shows all 4 rows when set 20 is done', () => {
    const c = cells(...Array<null>(19).fill(null), 'last');
    expect(cardCells(c)).toHaveLength(20);
    expect(cardCells(c)[19]).toBe('last');
  });

  it('is empty when nothing was done', () => {
    expect(cardCells(cells())).toEqual([]);
  });
});
