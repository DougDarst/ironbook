/**
 * Sample Barbell Bench Press sessions, Jul–Sep 2026, as used by the
 * History redesign's design mockups.
 * Each session is an 11-set warm-up ramp (45 → 145 × 10) followed by its
 * working sets; 20 sets each, all done. Test data only.
 */
import type { Session } from '../history';
import { emptySets, type SetSlot } from '../../model/sets';

type Pair = [weight: number, reps: number];

const RAMP: Pair[] = Array.from({ length: 11 }, (_, i) => [45 + i * 10, 10]);
const BASE: Pair[] = [
  [155, 10],
  [165, 10],
  [175, 10],
  [185, 10],
];
const times = (weight: number, reps: number, n: number): Pair[] => Array.from({ length: n }, () => [weight, reps]);

/** Working sets (after the ramp) per session date. */
export const BENCH_WORK: [date: string, work: Pair[]][] = [
  ['2026-07-02', [...BASE, ...times(195, 2, 5)]],
  ['2026-07-09', [...BASE, ...times(195, 3, 5)]],
  [
    '2026-07-13',
    [
      [155, 10],
      [165, 10],
      [175, 9],
      [185, 6],
      [185, 5],
      [185, 5],
      [185, 5],
      [185, 4],
      [185, 3],
    ],
  ],
  ['2026-07-21', [[155, 10], [165, 10], [175, 10], [185, 9], ...times(195, 3, 5)]],
  ['2026-07-28', [...BASE, ...times(195, 4, 5)]],
  ['2026-08-03', [...BASE, ...times(195, 5, 5)]],
  ['2026-08-11', [...BASE, ...times(195, 6, 5)]],
  ['2026-08-18', [...BASE, [195, 7], [195, 7], [195, 7], [195, 6], [195, 6]]],
  ['2026-08-24', [[155, 10], [165, 10], [175, 7], [185, 8], [195, 5], [195, 5], [195, 5], [195, 5], [195, 4]]],
  ['2026-09-01', [...BASE, ...times(195, 8, 5)]],
  ['2026-09-08', [...BASE, [195, 10], ...times(205, 3, 4)]],
  ['2026-09-14', [...BASE, [195, 10], ...times(205, 4, 4)]],
  ['2026-09-22', [...BASE, [195, 10], ...times(205, 5, 4)]],
];

function slots(pairs: readonly Pair[]): SetSlot[] {
  const s = emptySets();
  pairs.forEach(([weight, reps], i) => (s[i] = { weight, reps, done: true }));
  return s;
}

export const BENCH = 'bench';

/** The 13 sessions, as stored: finished, every set done. */
export const BENCH_SESSIONS: Session[] = BENCH_WORK.map(([date, work]) => ({
  date,
  status: 'finished',
  exercise: BENCH,
  sets: slots([...RAMP, ...work]),
}));
