import { describe, expect, it } from 'vitest';
import { doneVolume, splitRamp, topSet, type Session } from '../calc';
import { planImport, readCsv } from '../csv';
import { weekdayShort } from '../format';
import committed from '../../../docs/demo-data/sample.csv?raw';
import { DEMO_EXERCISES, demoSampleCsv, demoSessions } from './sample';

const END = '2026-11-21'; // a Saturday
const sessions = demoSessions({ end: END });
const of = (exercise: string) => sessions.filter((s) => s.exercise === exercise);
const top = (s: Session) => topSet(s.sets)!.weight;

describe('demoSessions', () => {
  it('is the same every time for the same options, and different for another seed', () => {
    expect(demoSampleCsv({ end: END })).toBe(demoSampleCsv({ end: END }));
    expect(demoSampleCsv({ end: END, seed: 7 })).not.toBe(demoSampleCsv({ end: END }));
  });

  it('has workouts on Mondays, Wednesdays and Fridays only, the latest on or before the end', () => {
    const dates = [...new Set(sessions.map((s) => s.date))];
    expect(new Set(dates.map(weekdayShort))).toEqual(new Set(['Mon', 'Wed', 'Fri']));
    expect(dates.at(-1)).toBe('2026-11-20'); // the Friday before
    expect(demoSessions({ end: '2026-11-18' }).at(-1)!.date).toBe('2026-11-18'); // a Wednesday: that day
    expect(dates[0]).toBe('2026-07-27'); // the Monday 16 weeks before the end's week
  });

  it('spans about four months at three workouts a week, skipping a few', () => {
    const workouts = new Set(sessions.map((s) => s.date)).size;
    expect(workouts).toBeGreaterThanOrEqual(45);
    expect(workouts).toBeLessThanOrEqual(51);
  });

  it('uses every demo exercise, at most 4 per workout and 20 sets per entry', () => {
    expect(new Set(sessions.map((s) => s.exercise))).toEqual(new Set(DEMO_EXERCISES));
    const perDay = new Map<string, number>();
    for (const s of sessions) perDay.set(s.date, (perDay.get(s.date) ?? 0) + 1);
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(4);
    for (const s of sessions) {
      expect(s.sets).toHaveLength(20);
      expect(s.sets.every((x) => x.done || (x.weight === null && x.reps === null))).toBe(true);
    }
  });

  it('gets stronger, with a lighter week every fifth week', () => {
    const squats = of('Back squat');
    expect(top(squats.at(-1)!)).toBeGreaterThan(top(squats[0]!) + 50);
    // Week 5 (the 5th Monday) is lighter than week 4.
    expect(squats[4]!.date).toBe('2026-08-24');
    expect(top(squats[4]!)).toBeLessThan(top(squats[3]!));
    expect(doneVolume(squats[4]!.sets)).toBeLessThan(doneVolume(squats[3]!.sets));
  });

  it("puts every warm-up set in History's ramp, and only working sets after it", () => {
    for (const s of sessions.filter((x) => ['Back squat', 'Deadlift', 'Bench press', 'Barbell row'].includes(x.exercise))) {
      const { ramp, work } = splitRamp(s.sets);
      expect(ramp.length, `${s.exercise} ${s.date}`).toBeGreaterThan(0);
      expect(work.every((w) => w.weight === top(s)), `${s.exercise} ${s.date}`).toBe(true);
    }
  });

  it('logs pull-ups at bodyweight (weight 0), with more reps over time', () => {
    const pullUps = of('Pull-up');
    expect(pullUps.every((s) => top(s) === 0)).toBe(true);
    const reps = (s: Session) => s.sets[0]!.reps!;
    expect(reps(pullUps.at(-1)!)).toBeGreaterThan(reps(pullUps[0]!));
  });
});

describe('demoSampleCsv', () => {
  it('imports cleanly: every session read back, none refused', () => {
    const { entries, problems } = readCsv(demoSampleCsv({ end: END }), END);
    expect(problems).toEqual([]);
    expect(entries).toHaveLength(sessions.length);
    // Into an empty account, as the demo account is: everything new, nothing refused.
    const plan = planImport(entries, { exercises: [], entries: [] });
    expect(plan.refused).toEqual([]);
    expect(plan.entryCount).toBe(sessions.length);
    expect(plan.workouts).toHaveLength(new Set(sessions.map((s) => s.date)).size);
    expect(plan.newExercises).toEqual([...DEMO_EXERCISES].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
  });

  it('matches the committed docs/demo-data/sample.csv (regenerate with npm run demo-sample)', () => {
    const { entries } = readCsv(committed, '9999-12-31');
    const latest = entries.map((e) => e.date).sort().at(-1)!;
    expect(committed).toBe(demoSampleCsv({ end: latest }));
  });
});
