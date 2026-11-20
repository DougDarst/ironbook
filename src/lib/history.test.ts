import { describe, expect, it } from 'vitest';
import { buildHistory, chipText, monthLabel, setChips, sheetDate, type HistoryRow, type HistorySession } from './history';
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

  it('carries each session\'s sets and workout', () => {
    const s = sets(done(45, 10), done(55.5, 8), { weight: 65, reps: 6, done: false }, done(75, 4));
    const row = buildHistory([session('bench', '2026-09-01', s)], [bench])[0]!.rows[1] as HistoryRow;
    expect(row.sets).toEqual(s);
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

describe('setChips', () => {
  // A ramp of 45, 95, 135 (all ≤ 75% of 205), then 185 × 5, 205 × 3 ×3, 205 × 2.
  const day = sets(
    done(45, 10),
    done(95, 8),
    done(135, 5),
    done(185, 5),
    done(205, 3),
    done(205, 3),
    { weight: 205, reps: 3, done: false },
    done(205, 3),
    done(205, 2),
  );
  const text = (view: { showRamp: boolean; grouped: boolean }) =>
    setChips(day, view).map((c) => {
      const { label, extra } = chipText(c);
      return [label, extra, c.kind === 'set' ? c.tone : 'ramp'].filter(Boolean).join(' | ');
    });

  it('by default: the ramp collapsed into one chip, repeated sets grouped, the top weight tinted', () => {
    expect(text({ showRamp: false, grouped: true })).toEqual([
      'Ramp 45→135 | 3 sets | ramp',
      '185 × 5 | work',
      '205 × 3 | ×3 | top', // the not-done set between them is skipped
      '205 × 2 | top',
    ]);
  });

  it('shows the ramp set by set when asked', () => {
    expect(text({ showRamp: true, grouped: true }).slice(0, 3)).toEqual(['45 × 10 | ramp', '95 × 8 | ramp', '135 × 5 | ramp']);
  });

  it('shows every set on its own when grouping is off', () => {
    expect(text({ showRamp: false, grouped: false })).toEqual([
      'Ramp 45→135 | 3 sets | ramp',
      '185 × 5 | work',
      '205 × 3 | top',
      '205 × 3 | top',
      '205 × 3 | top',
      '205 × 2 | top',
    ]);
  });

  it('has no ramp chip when there is no ramp, and no chips without done sets', () => {
    expect(setChips(sets(done(200, 5), done(200, 5)), { showRamp: false, grouped: true })).toEqual([
      { kind: 'set', weight: 200, reps: 5, count: 2, tone: 'top' },
    ]);
    expect(setChips(sets(), { showRamp: true, grouped: true })).toEqual([]);
  });

  it('writes a one-set ramp and decimal weights plainly', () => {
    expect(chipText({ kind: 'ramp', first: 45, last: 45, sets: 1 })).toEqual({ label: 'Ramp 45', extra: '1 set' });
    expect(chipText({ kind: 'set', weight: 102.5, reps: 8, count: 1, tone: 'work' })).toEqual({ label: '102.5 × 8', extra: null });
  });
});
