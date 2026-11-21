import { describe, expect, it } from 'vitest';
import {
  buildHistory,
  changeText,
  exerciseSubline,
  chipText,
  monthLabel,
  monthSummaryText,
  setChips,
  shortDate,
  summaryCards,
  topSetText, sheetDate, type HistoryRow, type HistorySession } from './history';
import { emptySets, type SetSlot } from './model/sets';
import { exerciseHistory, exerciseSummary } from './calc';
import { BENCH, BENCH_SESSIONS } from './calc/fixtures/bench';

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

describe('the sessions table (redesign Story 3)', () => {
  const data = [
    session('bench', '2026-09-08', sets(done(100, 10), done(120, 5), done(120, 6))),
    session('bench', '2026-09-22', sets(done(100, 9))),
    session('bench', '2026-10-01', sets(done(100, 10), done(110, 10))),
  ];
  const [section] = buildHistory(data, [{ id: 'bench', name: 'Bench' }]);
  const months = section!.rows.filter((r) => r.kind === 'month');
  const rows = section!.rows.filter((r): r is HistoryRow => r.kind === 'session');

  it('gives each month header its summary', () => {
    expect(months.map((m) => (m.kind === 'month' ? [m.month, monthSummaryText(m.summary)] : null))).toEqual([
      ['2026-09', '2 sessions · best 2,320 · 1 PR'],
      ['2026-10', '1 session · best 2,100 · 0 PRs'],
    ]);
  });

  it('gives each session its top set', () => {
    expect(rows.map((r) => topSetText(r.top))).toEqual(['120 × 6', '100 × 9', '110 × 10']);
    expect(topSetText(null)).toBe('—');
  });

  it('writes dates short, the year being in the month header', () => {
    expect(shortDate('2026-07-02')).toBe('7/2');
    expect(shortDate('2026-11-16')).toBe('11/16');
  });

  it('writes the change with an arrow, then the percentage', () => {
    expect(changeText(rows[0]!.change)).toEqual({ direction: 'first', amount: '—', percent: 'first session' });
    expect(changeText(rows[1]!.change)).toEqual({ direction: 'down', amount: '▼ 1,420', percent: '−61%' });
    expect(changeText(rows[2]!.change)).toEqual({ direction: 'up', amount: '▲ 1,200', percent: '+133%' });
    expect(changeText({ amount: 0.4, percent: 0.01 })).toEqual({ direction: 'same', amount: '0', percent: '0%' });
    expect(changeText({ amount: 500, percent: null })).toEqual({ direction: 'up', amount: '▲ 500', percent: '' });
  });
});

describe('summary cards (redesign Story 4)', () => {
  const summary = exerciseSummary(exerciseHistory(BENCH_SESSIONS, BENCH))!;

  it('read like the mockup for the sample bench sessions', () => {
    expect(summaryCards(summary).map((c) => [c.label, c.value, c.valueSuffix, c.sub, c.tone, c.trend])).toEqual([
      ['Latest volume', '23,300', null, '▲ 820 (+4%) · 9/22', 'default', 'up'],
      ['Best volume · PR', '25,050', null, 'Set on 9/1 · 195 × 8 × 5', 'pr', null],
      ['Heaviest top set', '205 × 5', null, 'Up from 195 × 2 in July', 'default', null],
      ['Volume PRs', '8', 'of 13', '+21% vs first session', 'default', null],
    ]);
    expect(exerciseSubline(summary)).toBe('13 sessions since Jul 2, 2026 · weights in lbs');
  });

  it('cover a single session, a drop, a lone top set and an older first session', () => {
    const one = exerciseSummary(exerciseHistory([session('x', '2025-12-30', sets(done(100, 5)))], 'x'))!;
    expect(summaryCards(one).map((c) => c.sub)).toEqual([
      'First session · 12/30',
      'Set on 12/30 · 100 × 5',
      'Same as your first session',
      'First session',
    ]);
    expect(exerciseSubline(one)).toBe('1 session since Dec 30, 2025 · weights in lbs');

    const two = exerciseSummary(
      exerciseHistory([session('x', '2025-12-30', sets(done(100, 5))), session('x', '2026-01-05', sets(done(110, 2)))], 'x'),
    )!;
    const [latest, , heaviest] = summaryCards(two);
    expect([latest!.sub, latest!.trend]).toEqual(['▼ 280 (−56%) · 1/5', 'down']);
    expect(heaviest!.sub).toBe('Up from 100 × 5 in December 2025');
  });

  it('say so when nothing was lifted', () => {
    const none = exerciseSummary(exerciseHistory([session('x', '2026-01-01', sets({ weight: 100, reps: 5, done: false }))], 'x'))!;
    expect(summaryCards(none)[2]).toMatchObject({ value: '—', sub: 'No sets done yet' });
  });
});
