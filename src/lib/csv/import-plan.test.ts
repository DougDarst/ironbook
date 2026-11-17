import { describe, expect, it } from 'vitest';
import { emptySets } from '../model/sets';
import { planImport, type ExistingData } from './import-plan';
import type { CsvEntry } from './logbook-csv';

let row = 1;
const entry = (exercise: string, date: string): CsvEntry => ({ row: ++row, exercise, date, sets: emptySets() });
const none: ExistingData = { exercises: [], entries: [] };

describe('planImport', () => {
  it('groups rows by date into new workouts, oldest first, in file order', () => {
    row = 1;
    const plan = planImport(
      [entry('Squat', '2026-07-11'), entry('Squat', '2026-07-07'), entry('Bench', '2026-07-07')],
      none,
    );
    expect(plan.workouts.map((w) => [w.date, w.workoutId, w.entries.map((e) => [e.exercise, e.position])])).toEqual([
      [
        '2026-07-07',
        null,
        [
          ['Squat', 0],
          ['Bench', 1],
        ],
      ],
      ['2026-07-11', null, [['Squat', 0]]],
    ]);
    expect(plan.entryCount).toBe(3);
    expect(plan.refused).toEqual([]);
  });

  it('matches existing exercises ignoring case, and creates each new one once', () => {
    const existing: ExistingData = { exercises: [{ id: 'sq', name: 'Barbell Squat' }], entries: [] };
    const plan = planImport(
      [entry('barbell squat', '2026-07-07'), entry('Curl', '2026-07-07'), entry('CURL', '2026-07-11'), entry('Bench', '2026-07-11')],
      existing,
    );
    expect(plan.newExercises).toEqual(['Bench', 'Curl']);
    expect(plan.workouts.flatMap((w) => w.entries.map((e) => e.exerciseId))).toEqual(['sq', null, null, null]);
  });

  it('adds to an existing workout on the same date, after its exercises', () => {
    const existing: ExistingData = {
      exercises: [{ id: 'sq', name: 'Squat' }],
      entries: [
        { workout: 'w1', date: '2026-07-07', exercise: 'sq', position: 0 },
        { workout: 'w1', date: '2026-07-07', exercise: 'other', position: 3 },
      ],
    };
    const plan = planImport([entry('Bench', '2026-07-07'), entry('Curl', '2026-07-07')], existing);
    expect(plan.workouts).toHaveLength(1);
    expect(plan.workouts[0]!.workoutId).toBe('w1');
    expect(plan.workouts[0]!.entries.map((e) => e.position)).toEqual([4, 5]);
  });

  it('refuses an exercise already logged on that date, never overwriting it', () => {
    row = 1;
    const existing: ExistingData = {
      exercises: [{ id: 'sq', name: 'Barbell Squat' }],
      entries: [{ workout: 'w1', date: '2026-07-07', exercise: 'sq', position: 0 }],
    };
    const plan = planImport([entry('BARBELL SQUAT', '2026-07-07'), entry('Barbell Squat', '2026-07-11')], existing);
    expect(plan.refused).toEqual([{ row: 2, message: 'BARBELL SQUAT on 7/7/26 is already logged.' }]);
    expect(plan.workouts.map((w) => w.date)).toEqual(['2026-07-11']);
    expect(plan.entryCount).toBe(1);
  });

  it('refuses rows that would take a date past 20 exercises, counting what is there', () => {
    row = 1;
    const existing: ExistingData = {
      exercises: [],
      entries: Array.from({ length: 18 }, (_, i) => ({ workout: 'w1', date: '2026-07-07', exercise: `x${i}`, position: i })),
    };
    const plan = planImport([entry('A', '2026-07-07'), entry('B', '2026-07-07'), entry('C', '2026-07-07')], existing);
    expect(plan.workouts[0]!.entries.map((e) => e.exercise)).toEqual(['A', 'B']);
    expect(plan.refused).toEqual([{ row: 4, message: '7/7/26 would have more than 20 exercises.' }]);
    // A new date's limit is 20 too.
    const many = planImport(
      Array.from({ length: 21 }, (_, i) => entry(`L${i}`, '2026-07-08')),
      none,
    );
    expect(many.workouts[0]!.entries).toHaveLength(20);
    expect(many.refused).toHaveLength(1);
  });

  it('plans nothing for nothing', () => {
    expect(planImport([], none)).toEqual({ workouts: [], newExercises: [], refused: [], entryCount: 0 });
  });

  it('leaves out a date whose every row was refused', () => {
    const existing: ExistingData = {
      exercises: [{ id: 'sq', name: 'Squat' }],
      entries: [{ workout: 'w1', date: '2026-07-07', exercise: 'sq', position: 0 }],
    };
    expect(planImport([entry('Squat', '2026-07-07')], existing).workouts).toEqual([]);
  });
});
