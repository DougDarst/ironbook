import { describe, expect, it } from 'vitest';
import { formatChange, formatPercent } from '../format';
import { emptySets, type SetSlot } from '../model/sets';
import { BENCH, BENCH_SESSIONS, BENCH_WORK } from './fixtures/bench';
import {
  doneVolume,
  exerciseHistory,
  groupSets,
  liftedSets,
  monthSummaries,
  RAMP_SHARE,
  splitRamp,
  topSet,
  type Session,
} from '.';

// The History redesign's calculations (spec Decisions, 2026-11-20), checked
// against sample bench sessions (fixtures/bench.ts) and the figures the
// redesign's mockups show for them.

const DATES = BENCH_WORK.map(([date]) => date);
const history = exerciseHistory(BENCH_SESSIONS, BENCH);
const byDate = (date: string) => BENCH_SESSIONS.find((s) => s.date === date)!;

function sets(...pairs: ([number, number] | [number, number, boolean])[]): SetSlot[] {
  const s = emptySets();
  pairs.forEach(([weight, reps, done = true], i) => (s[i] = { weight, reps, done }));
  return s;
}

describe('the bench fixture', () => {
  it('is 13 sessions of 20 done sets, starting with the 45 → 145 ramp', () => {
    expect(BENCH_SESSIONS).toHaveLength(13);
    for (const s of BENCH_SESSIONS) {
      expect(s.sets.every((slot) => slot.done)).toBe(true);
      expect(s.sets.slice(0, 2)).toEqual([
        { weight: 45, reps: 10, done: true },
        { weight: 55, reps: 10, done: true },
      ]);
    }
  });
});

describe('session volume: Σ weight × reps over done sets, warm-ups included', () => {
  it('matches the current app, 7/2 = 19,200 … 9/22 = 23,300', () => {
    expect(history.map((h) => [h.session.date, h.volume])).toEqual([
      ['2026-07-02', 19_200],
      ['2026-07-09', 20_175],
      ['2026-07-13', 20_405],
      ['2026-07-21', 19_990],
      ['2026-07-28', 21_150],
      ['2026-08-03', 22_125],
      ['2026-08-11', 23_100],
      ['2026-08-18', 23_685],
      ['2026-08-24', 21_035],
      ['2026-09-01', 25_050],
      ['2026-09-08', 21_660],
      ['2026-09-14', 22_480],
      ['2026-09-22', 23_300],
    ]);
  });

  it('includes the warm-up ramp (10,450 of 7/2’s 19,200)', () => {
    const { ramp } = splitRamp(byDate('2026-07-02').sets);
    const rampVolume = ramp.reduce((t, s) => t + s.weight * s.reps, 0);
    expect(rampVolume).toBe(10_450);
    expect(doneVolume(byDate('2026-07-02').sets)).toBe(19_200);
  });

  it('counts done sets only', () => {
    expect(doneVolume(sets([100, 10], [200, 5, false], [100, 5]))).toBe(1_500);
  });
});

describe('volume PRs: greater than every earlier session; the first counts', () => {
  it('marks 8 of the 13 sample sessions, as the mockups show', () => {
    expect(history.filter((h) => h.isPR).map((h) => h.session.date)).toEqual([
      '2026-07-02', // the first session
      '2026-07-09',
      '2026-07-13',
      '2026-07-28',
      '2026-08-03',
      '2026-08-11',
      '2026-08-18',
      '2026-09-01',
    ]);
  });

  it('is not a PR when it beats the previous session but not the best so far', () => {
    // 9/14's 22,480 beats 9/8's 21,660 but not 9/1's 25,050.
    expect(history.find((h) => h.session.date === '2026-09-14')!.isPR).toBe(false);
  });

  it('is not a PR on a tie', () => {
    const tie: Session[] = [
      { date: '2026-01-01', status: 'finished', exercise: 'x', sets: sets([100, 10]) },
      { date: '2026-01-02', status: 'finished', exercise: 'x', sets: sets([100, 10]) },
    ];
    expect(exerciseHistory(tie, 'x').map((h) => h.isPR)).toEqual([true, false]);
  });
});

describe('change and %: vs the previous session; the first has none', () => {
  it('9/22: ▲ 820, +4% (820 / 22,480 = 3.65%)', () => {
    const last = history.at(-1)!;
    expect(last.change).toEqual({ amount: 820, percent: (820 / 22_480) * 100 });
    expect(formatChange(last.change!.amount)).toBe('+820');
    expect(formatPercent(last.change!.percent)).toBe('+4%');
  });

  it('a drop is negative: 9/8 is −3,390 (−14%)', () => {
    const drop = history.find((h) => h.session.date === '2026-09-08')!.change!;
    expect(drop.amount).toBe(-3_390);
    expect(formatPercent(drop.percent)).toBe('−14%');
  });

  it('keeps the percentage exact; only the display rounds it to a whole number', () => {
    // 7/9: +975 / 19,200 = 5.078…% → +5%
    const change = history[1]!.change!;
    expect(change.percent).toBeCloseTo(5.078125, 6);
    expect(formatPercent(change.percent)).toBe('+5%');
  });

  it('the first session has no change ("—", "first session")', () => {
    expect(history[0]!.change).toBeNull();
  });

  it('the latest is +21% on the first session (23,300 vs 19,200)', () => {
    expect(formatPercent(((history.at(-1)!.volume - history[0]!.volume) / history[0]!.volume) * 100)).toBe('+21%');
  });
});

describe('top set: the highest weight, with the most reps at that weight', () => {
  it('reads each bench session', () => {
    expect(BENCH_SESSIONS.map((s) => topSet(s.sets))).toEqual([
      { weight: 195, reps: 2 },
      { weight: 195, reps: 3 },
      { weight: 185, reps: 6 }, // 7/13: 185 × 6, 5, 5, 5, 4, 3
      { weight: 195, reps: 3 },
      { weight: 195, reps: 4 },
      { weight: 195, reps: 5 },
      { weight: 195, reps: 6 },
      { weight: 195, reps: 7 }, // 8/18: 7, 7, 7, 6, 6
      { weight: 195, reps: 5 }, // 8/24: 5, 5, 5, 5, 4
      { weight: 195, reps: 8 },
      { weight: 205, reps: 3 }, // 9/8: 205 beats the 195 × 10 before it
      { weight: 205, reps: 4 },
      { weight: 205, reps: 5 },
    ]);
  });

  it('ignores sets that were not done, and is null with none done', () => {
    expect(topSet(sets([100, 5], [300, 1, false]))).toEqual({ weight: 100, reps: 5 });
    expect(topSet(sets([100, 5, false]))).toBeNull();
    expect(topSet(emptySets())).toBeNull();
  });

  it('takes the most reps at the top weight wherever it is', () => {
    expect(topSet(sets([200, 3], [150, 12], [200, 5], [200, 4]))).toEqual({ weight: 200, reps: 5 });
  });
});

describe('set grouping: consecutive sets with the same weight and reps merge', () => {
  it('8/18: 195 × 7 ×3 then 195 × 6 ×2', () => {
    const { work } = splitRamp(byDate('2026-08-18').sets);
    expect(groupSets(work)).toEqual([
      { weight: 155, reps: 10, count: 1 },
      { weight: 165, reps: 10, count: 1 },
      { weight: 175, reps: 10, count: 1 },
      { weight: 185, reps: 10, count: 1 },
      { weight: 195, reps: 7, count: 3 },
      { weight: 195, reps: 6, count: 2 },
    ]);
  });

  it('9/1: five sets of 195 × 8 become one group of 5', () => {
    expect(groupSets(splitRamp(byDate('2026-09-01').sets).work).at(-1)).toEqual({ weight: 195, reps: 8, count: 5 });
  });

  it('only consecutive sets merge', () => {
    const s = [
      { weight: 195, reps: 4 },
      { weight: 205, reps: 3 },
      { weight: 195, reps: 4 },
    ];
    expect(groupSets(s).map((g) => g.count)).toEqual([1, 1, 1]);
  });

  it('needs the same weight and the same reps', () => {
    expect(
      groupSets([
        { weight: 195, reps: 4 },
        { weight: 195, reps: 5 },
        { weight: 200, reps: 5 },
      ]),
    ).toHaveLength(3);
  });

  it('skips sets that were not done, so the sets around one are consecutive', () => {
    expect(groupSets(liftedSets(sets([195, 4], [195, 4, false], [195, 4])))).toEqual([{ weight: 195, reps: 4, count: 2 }]);
    expect(groupSets([])).toEqual([]);
  });
});

describe(`warm-up ramp: leading sets at or below ${RAMP_SHARE * 100}% of the top weight`, () => {
  it('is the 11 sets 45 → 145 when the top is 195 or 205', () => {
    for (const date of ['2026-07-02', '2026-09-01', '2026-09-22']) {
      const { ramp, work } = splitRamp(byDate(date).sets);
      expect(ramp, date).toHaveLength(11);
      expect([ramp[0]!.weight, ramp.at(-1)!.weight]).toEqual([45, 145]);
      expect(work[0]!.weight).toBe(155);
    }
  });

  it('7/13 (top 185; 75% = 138.75): 45 → 135, and 145 counts as working — the known borderline', () => {
    const { ramp, work } = splitRamp(byDate('2026-07-13').sets);
    expect(ramp).toHaveLength(10);
    expect(ramp.at(-1)!.weight).toBe(135);
    expect(work[0]).toEqual({ weight: 145, reps: 10 });
  });

  it('includes a set at exactly 75%', () => {
    expect(splitRamp(sets([150, 10], [200, 5])).ramp).toEqual([{ weight: 150, reps: 10 }]);
    expect(splitRamp(sets([150.01, 10], [200, 5])).ramp).toEqual([]);
  });

  it('only leading sets: a light set after a working set is a back-off set, not ramp', () => {
    const { ramp, work } = splitRamp(sets([45, 10], [200, 5], [100, 10]));
    expect(ramp).toEqual([{ weight: 45, reps: 10 }]);
    expect(work).toEqual([
      { weight: 200, reps: 5 },
      { weight: 100, reps: 10 },
    ]);
  });

  it('has no ramp without weight, or without done sets', () => {
    expect(splitRamp(sets([0, 20], [0, 15]))).toEqual({
      ramp: [],
      work: [
        { weight: 0, reps: 20 },
        { weight: 0, reps: 15 },
      ],
    });
    expect(splitRamp(emptySets())).toEqual({ ramp: [], work: [] });
  });

  it('keeps ramp + working sets = every done set, in order', () => {
    for (const s of BENCH_SESSIONS) {
      const { ramp, work } = splitRamp(s.sets);
      expect([...ramp, ...work]).toEqual(liftedSets(s.sets));
    }
  });
});

describe('month summaries: sessions, best volume and PRs per month', () => {
  it('July 4 PRs of 5, August 3 of 4, September 1 of 4', () => {
    expect(monthSummaries(history)).toEqual([
      { month: '2026-07', sessions: 5, best: 21_150, prs: 4 },
      { month: '2026-08', sessions: 4, best: 23_685, prs: 3 },
      { month: '2026-09', sessions: 4, best: 25_050, prs: 1 },
    ]);
  });

  it('is empty without sessions', () => {
    expect(monthSummaries([])).toEqual([]);
  });
});

it('covers every session date in the fixture', () => {
  expect(history.map((h) => h.session.date)).toEqual(DATES);
});
