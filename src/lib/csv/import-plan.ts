/**
 * What importing a file will do, worked out before anything is written:
 * which exercises to create, which workouts to create or add to, and which
 * rows to refuse (never overwrite). Pure and dependency-free; unit-tested in
 * import-plan.test.ts. The data layer (src/lib/data/import.ts) carries it out.
 */
import { sheetDate } from '../history';
import { MAX_EXERCISES_PER_WORKOUT } from '../model/workouts';
import type { SetSlot } from '../model/sets';
import type { CsvEntry, CsvProblem } from './logbook-csv';

/** What the app already has, as far as importing needs to know. */
export interface ExistingData {
  exercises: readonly { id: string; name: string }[];
  /** Every entry: its workout, that workout's date and status, its exercise and position. */
  entries: readonly { workout: string; date: string; exercise: string; position: number }[];
}

export interface PlannedEntry {
  row: number;
  /** The exercise's name as written in the file. */
  exercise: string;
  /** The existing exercise's id, or null for one the import creates. */
  exerciseId: string | null;
  sets: SetSlot[];
  position: number;
}

export interface PlannedWorkout {
  date: string;
  /** The existing workout on this date, or null to create a finished one. */
  workoutId: string | null;
  entries: PlannedEntry[];
}

export interface ImportPlan {
  /** Oldest first. */
  workouts: PlannedWorkout[];
  /** Names of the exercises to create (as first written in the file), alphabetical. */
  newExercises: string[];
  /** Rows that won't be imported, by row number. */
  refused: CsvProblem[];
  entryCount: number;
}

/** Exercise names match ignoring case (they're stored trimmed, with single spaces). */
const key = (name: string) => name.toLowerCase();

/**
 * Plans an import of `entries` (from readCsv) for a user with `existing`
 * data. Rows are grouped by date into one workout each: an existing workout
 * on that date is added to, otherwise a finished one is created. A row is
 * refused if its exercise is already logged on that date, or if its date
 * would then have more than 20 exercises.
 */
export function planImport(entries: readonly CsvEntry[], existing: ExistingData): ImportPlan {
  const exerciseIds = new Map(existing.exercises.map((e) => [key(e.name), e.id]));
  const workoutOn = new Map<string, string>(); // date → workout id
  const logged = new Set<string>(); // "date|exercise id"
  const count = new Map<string, number>(); // workout id → entries
  const lastPosition = new Map<string, number>(); // workout id → highest position
  for (const e of existing.entries) {
    workoutOn.set(e.date, e.workout);
    logged.add(`${e.date}|${e.exercise}`);
    count.set(e.workout, (count.get(e.workout) ?? 0) + 1);
    lastPosition.set(e.workout, Math.max(lastPosition.get(e.workout) ?? -1, e.position));
  }

  const byDate = new Map<string, PlannedWorkout>();
  const newExercises = new Map<string, string>(); // key → name as first written
  const refused: CsvProblem[] = [];
  let entryCount = 0;
  for (const entry of [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.row - b.row))) {
    const exerciseId = exerciseIds.get(key(entry.exercise)) ?? null;
    if (exerciseId && logged.has(`${entry.date}|${exerciseId}`)) {
      refused.push({ row: entry.row, message: `${entry.exercise} on ${sheetDate(entry.date)} is already logged.` });
      continue;
    }
    const workoutId = workoutOn.get(entry.date) ?? null;
    let workout = byDate.get(entry.date);
    if (!workout) {
      workout = { date: entry.date, workoutId, entries: [] };
      byDate.set(entry.date, workout);
    }
    const already = workoutId ? (count.get(workoutId) ?? 0) : 0;
    if (already + workout.entries.length >= MAX_EXERCISES_PER_WORKOUT) {
      refused.push({
        row: entry.row,
        message: `${sheetDate(entry.date)} would have more than ${MAX_EXERCISES_PER_WORKOUT} exercises.`,
      });
      continue;
    }
    const first = workoutId ? (lastPosition.get(workoutId) ?? -1) + 1 : 0;
    workout.entries.push({
      row: entry.row,
      exercise: entry.exercise,
      exerciseId,
      sets: entry.sets,
      position: first + workout.entries.length,
    });
    if (!exerciseId && !newExercises.has(key(entry.exercise))) newExercises.set(key(entry.exercise), entry.exercise);
    entryCount += 1;
  }

  return {
    workouts: [...byDate.values()].filter((w) => w.entries.length > 0),
    newExercises: [...newExercises.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    refused: refused.sort((a, b) => a.row - b.row),
    entryCount,
  };
}
