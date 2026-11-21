import { describe, expect, it } from 'vitest';
import { emptySets, type SetSlot } from '../model/sets';
import { indexSeries, liftColorSlots, periodDays, periodSummary, periodWindows, type Session } from '.';

// The "All exercises" view's period figures (History redesign Story 5).

function sets(weight: number, reps: number, done = true): SetSlot[] {
  const s = emptySets();
  s[0] = { weight, reps, done };
  return s;
}
const session = (exercise: string, date: string, volume: number, status: Session['status'] = 'finished'): Session => ({
  exercise,
  date,
  status,
  sets: sets(volume, 1),
});

describe('periodWindows', () => {
  it('this month: the 1st to today, against the same days of last month', () => {
    expect(periodWindows('month', '2026-11-20')).toEqual({
      current: { start: '2026-11-01', end: '2026-11-20' },
      previous: { start: '2026-10-01', end: '2026-10-20' },
    });
  });

  it('shortens the previous month when it has fewer days, and crosses the year', () => {
    expect(periodWindows('month', '2026-03-31').previous).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(periodWindows('month', '2027-01-15').previous).toEqual({ start: '2026-12-01', end: '2026-12-15' });
  });

  it('last 90 days: today and the 89 before, against the 90 before that', () => {
    expect(periodWindows('90d', '2026-11-20')).toEqual({
      current: { start: '2026-08-23', end: '2026-11-20' },
      previous: { start: '2026-05-25', end: '2026-08-22' },
    });
  });
});

describe('periodSummary', () => {
  const TODAY = '2026-11-20';
  const data: Session[] = [
    // Bench: 1000 (Sep), 1200 (Oct 5), 1100 (Nov 2), 1500 (Nov 15, PR)
    session('bench', '2026-09-10', 1000),
    session('bench', '2026-10-05', 1200),
    session('bench', '2026-11-02', 1100),
    session('bench', '2026-11-15', 1500),
    // Squat: 2000 (Oct 12), 2100 (Nov 2, PR, same day as bench), a draft today
    session('squat', '2026-10-12', 2000),
    session('squat', '2026-11-02', 2100),
    session('squat', '2026-11-20', 9999, 'draft'),
    // Row: only in October 25 (after Oct 20, so outside "the same days")
    session('row', '2026-10-25', 800),
  ];
  const month = periodSummary(data, ['bench', 'row', 'squat'], 'month', TODAY);

  it('counts workout days and volume, against the same days last month', () => {
    expect([month.workouts, month.previousWorkouts]).toEqual([2, 2]); // Nov 2, 15 vs Oct 5, 12 (Oct 25 is after the 20th)
    expect([month.volume, month.previousVolume]).toEqual([4_700, 3_200]); // 1100 + 1500 + 2100 vs 1200 + 2000
  });

  it('lists the PRs set in the period, oldest first (all-time PRs, not just the period’s)', () => {
    expect(month.prs).toEqual([
      { exercise: 'squat', date: '2026-11-02' },
      { exercise: 'bench', date: '2026-11-15' },
    ]);
  });

  it('gives each lift with a session its sessions, volume, previous volume and best session', () => {
    expect(month.lifts).toEqual([
      {
        exercise: 'bench',
        sessions: 2,
        volume: 2_600,
        previousVolume: 1_200,
        best: { date: '2026-11-15', volume: 1_500, isPR: true },
      },
      {
        exercise: 'squat',
        sessions: 1,
        volume: 2_100,
        previousVolume: 2_000,
        best: { date: '2026-11-02', volume: 2_100, isPR: true },
      },
    ]); // row had nothing this month
  });

  it('picks the most improved lift (two sessions needed): bench, +36% since Nov 2', () => {
    expect(month.mostImproved).toEqual({ exercise: 'bench', percent: (400 / 1_100) * 100, since: '2026-11-02' });
  });

  it('works over the last 90 days too', () => {
    const d90 = periodSummary(data, ['bench', 'row', 'squat'], '90d', TODAY); // Aug 23 – Nov 20
    expect(d90.workouts).toBe(6);
    expect(d90.volume).toBe(9_700);
    expect(d90.lifts.map((l) => [l.exercise, l.sessions])).toEqual([
      ['bench', 4],
      ['row', 1],
      ['squat', 2],
    ]);
    // Bench, 1000 → 1500 = +50%, beats squat's +5%.
    expect(d90.mostImproved).toEqual({ exercise: 'bench', percent: 50, since: '2026-09-10' });
    expect(d90.previousVolume).toBe(0);
  });

  it('is empty without sessions in the period, and has no most improved with single sessions', () => {
    const quiet = periodSummary(data, ['bench', 'squat'], 'month', '2027-06-10');
    expect([quiet.workouts, quiet.volume, quiet.prs, quiet.lifts, quiet.mostImproved]).toEqual([0, 0, [], [], null]);
    const once = periodSummary([session('x', '2026-11-03', 100)], ['x'], 'month', TODAY);
    expect(once.mostImproved).toBeNull();
  });

  it('keeps the earliest best session on a tie, and skips a lift whose first period session lifted nothing', () => {
    const s = periodSummary(
      [session('x', '2026-11-01', 0), session('x', '2026-11-05', 500), session('x', '2026-11-09', 500)],
      ['x'],
      'month',
      TODAY,
    );
    expect(s.lifts[0]!.best.date).toBe('2026-11-05');
    expect(s.mostImproved).toBeNull(); // first session's volume was 0
  });
});

describe('the All exercises charts (Story 6)', () => {
  const data: Session[] = [
    session('bench', '2026-09-10', 1000),
    session('bench', '2026-11-02', 1100),
    session('squat', '2026-11-02', 2000),
    session('bench', '2026-11-09', 900),
    session('bench', '2026-11-15', 1650),
    session('squat', '2026-11-15', 1900),
    session('row', '2026-11-12', 0),
    session('row', '2026-11-14', 500),
  ];
  const november = { start: '2026-11-01', end: '2026-11-20' };

  it('periodDays: each workout day with each lift’s volume, the total, and whether it had a PR', () => {
    expect(periodDays(data, ['bench', 'squat', 'row'], november)).toEqual([
      {
        date: '2026-11-02',
        lifts: [
          { exercise: 'bench', volume: 1100 },
          { exercise: 'squat', volume: 2000 },
        ],
        total: 3100,
        hasPR: true, // both beat everything before
      },
      { date: '2026-11-09', lifts: [{ exercise: 'bench', volume: 900 }], total: 900, hasPR: false },
      { date: '2026-11-12', lifts: [{ exercise: 'row', volume: 0 }], total: 0, hasPR: false },
      { date: '2026-11-14', lifts: [{ exercise: 'row', volume: 500 }], total: 500, hasPR: true },
      {
        date: '2026-11-15',
        lifts: [
          { exercise: 'bench', volume: 1650 },
          { exercise: 'squat', volume: 1900 },
        ],
        total: 3550,
        hasPR: true, // bench 1,650 is a PR; squat isn't
      },
    ]);
  });

  it('indexSeries: each lift as a % of its first session in the period; lifts with a 0 base are left out', () => {
    const series = indexSeries(data, ['bench', 'squat', 'row'], november);
    expect(series.map((s) => [s.exercise, s.points.map((p) => Math.round(p.index * 10) / 10)])).toEqual([
      ['bench', [100, 81.8, 150]],
      ['squat', [100, 95]],
    ]); // row's first November session lifted nothing
  });

  it('liftColorSlots: by first logged (ties by id), stable; past the palette, null', () => {
    const slots = liftColorSlots(data, ['bench', 'squat', 'row']);
    expect([...slots]).toEqual([
      ['bench', 1], // Sep 10
      ['squat', 2], // Nov 2
      ['row', 3], // Nov 12
    ]);
    const many = liftColorSlots(
      ['a', 'b', 'c'].map((x) => session(x, '2026-01-01', 1)),
      ['a', 'b', 'c'],
      2,
    );
    expect([...many]).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', null],
    ]);
  });
});
