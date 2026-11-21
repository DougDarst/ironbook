import { describe, expect, it } from 'vitest';
import { periodSummary, type Session } from './calc';
import { periodCards, periodSubline, previousText, rangeText, versusPrevious } from './history-all';
import { emptySets } from './model/sets';

// Wording for the "All exercises" view (History redesign Story 5).

const session = (exercise: string, date: string, volume: number): Session => {
  const sets = emptySets();
  sets[0] = { weight: volume, reps: 1, done: true };
  return { exercise, date, status: 'finished', sets };
};
const names = new Map([
  ['bench', 'Barbell Bench Press'],
  ['squat', 'Back Squat'],
  ['row', 'Barbell Row'],
  ['ohp', 'Overhead Press'],
]);
const TODAY = '2026-11-20';

describe('ranges and the header line', () => {
  it('writes ranges compactly', () => {
    expect(rangeText('2026-10-01', '2026-10-20')).toBe('Oct 1–20');
    expect(rangeText('2026-08-23', '2026-11-20')).toBe('Aug 23 – Nov 20');
  });

  it('names the period and counts its lifts', () => {
    const s = periodSummary([session('bench', '2026-11-02', 100)], ['bench'], 'month', TODAY);
    expect(periodSubline(s, 'month')).toBe('November 2026 · 1 lift · weights in lbs');
    expect(previousText(s, 'month')).toBe('Oct 1–20');
    const d = periodSummary([], ['bench'], '90d', TODAY);
    expect(periodSubline(d, '90d')).toBe('Aug 23 – Nov 20 · 0 lifts · weights in lbs');
    expect(previousText(d, '90d')).toBe('the previous 90 days');
  });
});

describe('versusPrevious', () => {
  it('gives the change in whole percent with an arrow, "Same", or "New"', () => {
    expect(versusPrevious(1_360, 1_000)).toEqual({ text: '▲ 36%', trend: 'up' });
    expect(versusPrevious(950, 1_000)).toEqual({ text: '▼ 5%', trend: 'down' });
    expect(versusPrevious(1_002, 1_000)).toEqual({ text: 'Same', trend: null });
    expect(versusPrevious(500, 0)).toEqual({ text: 'New', trend: null });
  });
});

describe('periodCards', () => {
  const data = [
    session('bench', '2026-10-05', 1_000),
    session('bench', '2026-11-02', 1_100),
    session('bench', '2026-11-15', 1_500),
    session('squat', '2026-11-02', 2_000),
    session('row', '2026-11-03', 800),
    session('ohp', '2026-11-04', 500),
  ];
  const text = (s: ReturnType<typeof periodSummary>) =>
    periodCards(s, 'month', names).map((c) => [c.label, c.value, c.sub, c.tone, c.trend]);

  it('read the month against the same days of last month', () => {
    expect(text(periodSummary(data, [...names.keys()], 'month', TODAY))).toEqual([
      ['Workouts', '4', '▲ 3 vs Oct 1–20', 'default', 'up'], // Nov 2, 3, 4, 15 vs Oct 5
      ['Total volume', '5,900', '▲ 490% vs Oct 1–20', 'default', 'up'], // 5,900 vs 1,000
      [
        'PRs this month',
        '5', // bench 11/2 (beats October's 1,000) and 11/15, squat, row, ohp
        'Barbell Bench Press 11/2 · Back Squat 11/2 · Barbell Row 11/3 · +2 more',
        'pr',
        null,
      ],
      ['Most improved', '+36%', 'Barbell Bench Press · session volume since 11/2', 'default', null],
    ]);
  });

  it('say so when there was nothing before, no PRs, or no lift with two sessions', () => {
    const quiet = periodSummary([session('bench', '2026-11-02', 900), session('bench', '2026-11-09', 800)], ['bench'], 'month', '2026-11-20');
    const flat = periodSummary(
      [session('bench', '2026-10-02', 900), session('bench', '2026-11-02', 900)],
      ['bench'],
      'month',
      '2026-11-20',
    );
    expect(text(quiet).map((c) => c[2])).toEqual([
      '▲ 2 vs Oct 1–20',
      'Nothing logged in Oct 1–20',
      'Barbell Bench Press 11/2',
      'Barbell Bench Press · session volume since 11/2',
    ]);
    expect(text(quiet)[3]![1]).toBe('−11%'); // 900 → 800
    expect(text(flat).map((c) => c[2])).toEqual(['Same as Oct 1–20', 'Same as Oct 1–20', 'None yet', 'Needs two sessions of a lift']);
    expect(text(flat)[2]![3]).toBe('default');
  });

  it('label the PR card for the last 90 days', () => {
    expect(periodCards(periodSummary(data, ['bench'], '90d', TODAY), '90d', names)[2]!.label).toBe('PRs · last 90 days');
  });
});
