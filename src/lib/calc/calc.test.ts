import { describe, expect, it } from 'vitest';
import { emptySets, type SetSlot } from '../model/sets';
import {
  changeVs,
  doneCount,
  doneVolume,
  exerciseHistory,
  groupVolumes,
  isVolumePR,
  lastTime,
  monthlyTotals,
  plannedVolume,
  setVolume,
  type Session,
} from './index';

/** Twenty slots: the given ones filled in from slot 1, the rest empty. */
function sets(...filled: Partial<SetSlot>[]): SetSlot[] {
  return emptySets().map((slot, i) => ({ ...slot, ...(filled[i] ?? {}) }));
}
const done = (weight: number, reps: number): Partial<SetSlot> => ({ weight, reps, done: true });
const notDone = (weight: number, reps: number): Partial<SetSlot> => ({ weight, reps, done: false });

/** A finished session of exercise "bench" with the given done volume. */
function session(date: string, volume: number, extra: Partial<Session> = {}): Session {
  return { date, status: 'finished', exercise: 'bench', sets: sets(done(volume, 1)), ...extra };
}

describe('volume', () => {
  it('counts only done sets', () => {
    const s = sets(done(100, 10), notDone(200, 10), done(50, 5));
    expect(doneVolume(s)).toBe(1250);
  });

  it('is 0 for empty sets and for all-undone sets', () => {
    expect(doneVolume(emptySets())).toBe(0);
    expect(doneVolume(sets(notDone(225, 5), notDone(225, 5)))).toBe(0);
  });

  it('plans every slot with both numbers, done or not', () => {
    const s = sets(done(100, 10), notDone(200, 10), { weight: 300 }, { reps: 8 });
    expect(plannedVolume(s)).toBe(3000);
  });

  it('is exact with decimal weights', () => {
    // Naive floating point: 0.1*3 + 0.2*3 = 0.9000000000000001.
    expect(doneVolume(sets(done(0.1, 3), done(0.2, 3)))).toBe(0.9);
    expect(doneVolume(sets(done(2.5, 3), done(1.25, 8), done(102.35, 7)))).toBe(7.5 + 10 + 716.45);
  });

  it('is exact even for weights that are inexact in binary', () => {
    // 1.15 * 100 = 114.99999999999999 and 0.29 * 100 = 28.999999999999996.
    expect(doneVolume(sets(done(1.15, 3), done(0.29, 7)))).toBe(5.48);
    expect(plannedVolume(sets(notDone(1.15, 3), notDone(0.29, 7)))).toBe(5.48);
  });

  it('counts a bodyweight set (weight 0) as 0 volume but done', () => {
    const s = sets(done(0, 12));
    expect(doneVolume(s)).toBe(0);
    expect(doneCount(s)).toBe(1);
  });

  it('gives a single slot its volume whether or not it is done', () => {
    expect(setVolume({ weight: 135, reps: 8, done: false })).toBe(1080);
    expect(setVolume({ weight: null, reps: 8, done: false })).toBe(0);
  });

  it('counts done slots', () => {
    expect(doneCount(sets(done(1, 1), notDone(1, 1), done(1, 1)))).toBe(2);
    expect(doneCount(emptySets())).toBe(0);
  });

  it('splits 20 slots into 4 groups of 5 with done and total volume', () => {
    const s = sets(done(100, 10), notDone(100, 10), {}, {}, {}, done(50, 2));
    expect(groupVolumes(s)).toEqual([
      { done: 1000, total: 2000 },
      { done: 100, total: 100 },
      { done: 0, total: 0 },
      { done: 0, total: 0 },
    ]);
  });
});

describe('lastTime', () => {
  const history: Session[] = [
    session('2026-11-03', 100),
    session('2026-11-10', 200),
    session('2026-11-07', 150),
    session('2026-11-12', 999, { status: 'draft' }),
    session('2026-11-11', 999, { exercise: 'squat' }),
  ];

  it('is the most recent finished session before the date, whatever the input order', () => {
    expect(lastTime(history, 'bench', '2026-11-13')?.date).toBe('2026-11-10');
    expect(lastTime(history, 'bench', '2026-11-09')?.date).toBe('2026-11-07');
  });

  it('excludes the same date (a workout is never its own last time)', () => {
    expect(lastTime(history, 'bench', '2026-11-10')?.date).toBe('2026-11-07');
  });

  it('ignores drafts and other exercises', () => {
    expect(lastTime(history, 'bench', '2026-11-30')?.date).toBe('2026-11-10');
    expect(lastTime(history, 'squat', '2026-11-11')).toBeNull();
  });

  it('is null for the first session', () => {
    expect(lastTime(history, 'bench', '2026-11-03')).toBeNull();
    expect(lastTime([], 'bench', '2026-11-13')).toBeNull();
  });

  it('still counts a finished session with no done sets', () => {
    const s = [session('2026-11-01', 100), { ...session('2026-11-05', 0), sets: sets(notDone(225, 5)) }];
    expect(lastTime(s, 'bench', '2026-11-10')?.date).toBe('2026-11-05');
  });
});

describe('changeVs', () => {
  it('gives the difference and the percentage of last time', () => {
    expect(changeVs(1100, 1000)).toEqual({ amount: 100, percent: 10 });
    expect(changeVs(750, 1000)).toEqual({ amount: -250, percent: -25 });
    expect(changeVs(1000, 1000)).toEqual({ amount: 0, percent: 0 });
  });

  it('is blank (null) for the first session', () => {
    expect(changeVs(1000, null)).toBeNull();
  });

  it('has no percentage when last time was 0', () => {
    expect(changeVs(500, 0)).toEqual({ amount: 500, percent: null });
  });

  it('is exact with decimal volumes', () => {
    expect(changeVs(0.3, 0.1)?.amount).toBe(0.2);
  });
});

describe('isVolumePR', () => {
  it('needs to beat every earlier session', () => {
    expect(isVolumePR(1100, [1000, 900])).toBe(true);
    expect(isVolumePR(950, [1000, 900])).toBe(false);
  });

  it('is not a PR on a tie', () => {
    expect(isVolumePR(1000, [1000, 900])).toBe(false);
  });

  it('counts the first session, unless it has 0 volume', () => {
    expect(isVolumePR(500, [])).toBe(true);
    expect(isVolumePR(0, [])).toBe(false);
  });
});

describe('exerciseHistory', () => {
  it('lists finished sessions oldest first with volume, change and PRs', () => {
    const rows = exerciseHistory(
      [
        session('2026-11-10', 1200),
        session('2026-11-03', 1000),
        session('2026-11-07', 900),
        session('2026-11-14', 1200), // tie with the best: not a PR
        session('2026-11-17', 1300),
      ],
      'bench',
    );
    expect(rows.map((r) => [r.session.date, r.volume, r.change, r.isPR])).toEqual([
      ['2026-11-03', 1000, null, true], // first session
      ['2026-11-07', 900, { amount: -100, percent: -10 }, false],
      ['2026-11-10', 1200, { amount: 300, percent: (300 / 900) * 100 }, true],
      ['2026-11-14', 1200, { amount: 0, percent: 0 }, false],
      ['2026-11-17', 1300, { amount: 100, percent: (100 / 1200) * 100 }, true],
    ]);
  });

  it('excludes drafts, from the list and from PRs and changes', () => {
    const rows = exerciseHistory(
      [session('2026-11-03', 1000), session('2026-11-07', 5000, { status: 'draft' }), session('2026-11-10', 1100)],
      'bench',
    );
    expect(rows.map((r) => r.session.date)).toEqual(['2026-11-03', '2026-11-10']);
    expect(rows[1]).toMatchObject({ isPR: true, change: { amount: 100, percent: 10 } });
  });

  it('ignores other exercises', () => {
    const rows = exerciseHistory([session('2026-11-03', 1000), session('2026-11-04', 9999, { exercise: 'squat' })], 'bench');
    expect(rows).toHaveLength(1);
  });

  it('does not make a 0-volume first session a PR; the first real one is', () => {
    const empty = { ...session('2026-11-03', 0), sets: sets(notDone(225, 5)) };
    const rows = exerciseHistory([empty, session('2026-11-07', 800)], 'bench');
    expect(rows.map((r) => [r.volume, r.isPR, r.change])).toEqual([
      [0, false, null],
      [800, true, { amount: 800, percent: null }], // last time was 0: no %
    ]);
  });

  it('is empty without finished sessions', () => {
    expect(exerciseHistory([session('2026-11-03', 1000, { status: 'draft' })], 'bench')).toEqual([]);
  });

  it('keeps the caller’s session objects (for ids, etc.)', () => {
    const s = { ...session('2026-11-03', 100), id: 'entry-1' };
    expect(exerciseHistory([s], 'bench')[0]!.session.id).toBe('entry-1');
  });
});

describe('monthlyTotals', () => {
  it('sums each month, with gap months as 0 through the current month', () => {
    const totals = monthlyTotals(
      [
        session('2026-08-05', 100),
        session('2026-08-20', 50),
        session('2026-10-01', 300),
        session('2026-11-02', 70),
      ],
      'bench',
      '2026-11-13',
    );
    expect(totals).toEqual([
      { month: '2026-08', volume: 150, current: false },
      { month: '2026-09', volume: 0, current: false },
      { month: '2026-10', volume: 300, current: false },
      { month: '2026-11', volume: 70, current: true },
    ]);
  });

  it('runs on to the current month even with no sessions in it', () => {
    const totals = monthlyTotals([session('2026-09-30', 100)], 'bench', '2026-11-13');
    expect(totals.map((t) => [t.month, t.volume, t.current])).toEqual([
      ['2026-09', 100, false],
      ['2026-10', 0, false],
      ['2026-11', 0, true],
    ]);
  });

  it('crosses year boundaries', () => {
    const totals = monthlyTotals([session('2025-12-31', 10), session('2026-01-01', 20)], 'bench', '2026-01-15');
    expect(totals.map((t) => t.month)).toEqual(['2025-12', '2026-01']);
  });

  it('counts only done sets of finished sessions of this exercise', () => {
    const totals = monthlyTotals(
      [
        { date: '2026-11-01', status: 'finished', exercise: 'bench', sets: sets(done(100, 2), notDone(500, 5)) },
        session('2026-11-02', 999, { status: 'draft' }),
        session('2026-11-03', 999, { exercise: 'squat' }),
      ],
      'bench',
      '2026-11-13',
    );
    expect(totals).toEqual([{ month: '2026-11', volume: 200, current: true }]);
  });

  it('is exact with decimal volumes', () => {
    const totals = monthlyTotals(
      [session('2026-11-01', 0.1), session('2026-11-02', 0.2)],
      'bench',
      '2026-11-13',
    );
    expect(totals[0]!.volume).toBe(0.3);
  });

  it('is empty without finished sessions', () => {
    expect(monthlyTotals([], 'bench', '2026-11-13')).toEqual([]);
    expect(monthlyTotals([session('2026-11-01', 100, { status: 'draft' })], 'bench', '2026-11-13')).toEqual([]);
  });
});
