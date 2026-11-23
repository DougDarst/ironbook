/**
 * Invented sample history for demo accounts (Story 23), as a CSV in the
 * import format. Never based on anyone's real data: the repo is public.
 *
 * Three workouts a week (Mon A, Wed B, Fri C) for `weeks` weeks, ending on
 * or before `end`: warm-up ramps on the barbell lifts, slow progress, a
 * lighter week every fifth week, a few missed reps and skipped sessions.
 * Deterministic: the same options always give the same file. Pure and
 * dependency-free (calendar arithmetic only); tested in sample.test.ts.
 */
import type { Session } from '../calc';
import { exportCsv } from '../csv/logbook-csv';
import { weekday } from '../format';
import { addDays } from '../model/dates';
import { emptySets, type SetSlot } from '../model/sets';

export const DEMO_EXERCISES = [
  'Back squat',
  'Deadlift',
  'Bench press',
  'Overhead press',
  'Barbell row',
  'Pull-up',
  'Romanian deadlift',
  'Bulgarian split squat',
  'Dumbbell curl',
  'Lat pulldown',
] as const;
type Exercise = (typeof DEMO_EXERCISES)[number];

interface Lift {
  /** Working weight in week 0, and how it grows: `step` lbs every `every` weeks. */
  start: number;
  step: number;
  every: number;
  /** Plate increment the weights round to. */
  round: number;
  sets: number;
  reps: number;
  /** Warm-up sets before the working sets: [fraction of the working weight, reps]; 0 means the empty bar. */
  ramp: readonly (readonly [number, number])[];
}

const BAR = 45;
const LIFTS: Record<Exclude<Exercise, 'Pull-up'>, Lift> = {
  'Back squat': { start: 185, step: 5, every: 1, round: 5, sets: 3, reps: 5, ramp: [[0, 10], [0.4, 5], [0.55, 5], [0.7, 3]] },
  Deadlift: { start: 225, step: 5, every: 1, round: 5, sets: 2, reps: 5, ramp: [[0.45, 5], [0.6, 3], [0.7, 2]] },
  'Bench press': { start: 135, step: 2.5, every: 1, round: 2.5, sets: 3, reps: 5, ramp: [[0, 10], [0.5, 5], [0.7, 3]] },
  'Overhead press': { start: 85, step: 2.5, every: 2, round: 2.5, sets: 3, reps: 5, ramp: [[0, 10], [0.7, 3]] },
  'Barbell row': { start: 115, step: 2.5, every: 1, round: 2.5, sets: 3, reps: 8, ramp: [[0, 10], [0.65, 5]] },
  'Romanian deadlift': { start: 135, step: 5, every: 2, round: 5, sets: 3, reps: 8, ramp: [[0.6, 5]] },
  'Bulgarian split squat': { start: 25, step: 5, every: 4, round: 5, sets: 3, reps: 8, ramp: [] },
  'Dumbbell curl': { start: 25, step: 5, every: 5, round: 5, sets: 3, reps: 10, ramp: [] },
  'Lat pulldown': { start: 100, step: 5, every: 3, round: 5, sets: 3, reps: 10, ramp: [] },
};

/** Monday, Wednesday, Friday: the exercises of each workout, in order. */
const PLAN: readonly (readonly Exercise[])[] = [
  ['Back squat', 'Bench press', 'Barbell row', 'Dumbbell curl'],
  ['Deadlift', 'Overhead press', 'Pull-up', 'Lat pulldown'],
  ['Romanian deadlift', 'Bulgarian split squat', 'Bench press', 'Barbell row'],
];

/** Every fifth week is lighter (90%). */
const isDeload = (week: number) => week % 5 === 4;

/** A small seeded random number generator (mulberry32): the same seed gives the same numbers. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const roundTo = (weight: number, step: number) => Math.round(weight / step) * step;

/** The sets of one lift in one week. */
function liftSets(lift: Lift, week: number, rand: () => number): SetSlot[] {
  const progressed = lift.start + lift.step * Math.floor(week / lift.every);
  const work = roundTo(isDeload(week) ? progressed * 0.9 : progressed, lift.round);
  const sets: SetSlot[] = [];
  let last = 0;
  for (const [fraction, reps] of lift.ramp) {
    const weight = fraction === 0 ? BAR : Math.max(BAR, roundTo(work * fraction, 5));
    if (weight <= last || weight >= work) continue;
    sets.push({ weight, reps, done: true });
    last = weight;
  }
  for (let i = 0; i < lift.sets; i++) {
    // Now and then the last working set comes up a rep or two short (never in a lighter week).
    const short = i === lift.sets - 1 && !isDeload(week) && rand() < 0.15 ? 1 + Math.floor(rand() * 2) : 0;
    sets.push({ weight: work, reps: lift.reps - short, done: true });
  }
  return sets;
}

/** Bodyweight pull-ups (weight 0): three sets, a rep more every three weeks, up to 12. */
function pullUpSets(week: number, rand: () => number): SetSlot[] {
  const extra = Math.floor(week / 3);
  return [6, 5, 5].map((base, i) => {
    const short = i === 2 && rand() < 0.2 ? 1 : 0;
    return { weight: 0, reps: Math.min(12, base + extra) - short, done: true };
  });
}

export interface DemoOptions {
  /** The last day the sample may have a workout on ("YYYY-MM-DD"), usually yesterday. */
  end: string;
  weeks?: number;
  seed?: number;
}

/** The finished sessions of the sample (exercise = its name). */
export function demoSessions({ end, weeks = 17, seed = 23 }: DemoOptions): Session[] {
  const rand = random(seed);
  // The Monday of the week holding `end`, then back to the first week.
  const firstMonday = addDays(end, -((weekday(end) + 6) % 7) - (weeks - 1) * 7);
  const sessions: Session[] = [];
  for (let week = 0; week < weeks; week++) {
    for (const [day, exercises] of PLAN.entries()) {
      const date = addDays(firstMonday, week * 7 + day * 2);
      if (date > end) continue;
      // About one session in twenty is skipped (never the most recent week).
      if (week < weeks - 1 && rand() < 0.05) continue;
      for (const exercise of exercises) {
        const done = exercise === 'Pull-up' ? pullUpSets(week, rand) : liftSets(LIFTS[exercise], week, rand);
        const sets = emptySets();
        done.forEach((s, i) => (sets[i] = s));
        sessions.push({ date, status: 'finished', exercise, sets });
      }
    }
  }
  return sessions;
}

/** The sample as CSV in the import format (with a Volume column, like an export). */
export function demoSampleCsv(options: DemoOptions): string {
  return exportCsv(
    demoSessions(options),
    DEMO_EXERCISES.map((name) => ({ id: name, name })),
  );
}
