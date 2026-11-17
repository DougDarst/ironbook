/**
 * Reading and writing the logbook through PocketBase. API rules limit
 * every query to the signed-in user's records, so no user filter is needed.
 */
import type { RecordModel } from 'pocketbase';
import type { Session } from '../calc';
import { normalizeExerciseName } from '../model/exercises';
import type { SetSlot } from '../model/sets';
import { pb } from '../pb';
import { lastTime } from '../calc';
import { newRecordId, prefillSets } from '../workout';

export interface Exercise {
  id: string;
  name: string;
}

export interface Workout {
  id: string;
  date: string;
  status: 'draft' | 'finished';
}

/** One entry, as the calc module sees it, plus its ids. */
export interface SessionEntry extends Session {
  id: string;
  workout: string;
  /** Order within its workout. */
  position: number;
}

const byName = (a: Exercise, b: Exercise) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/** All of the user's exercises, alphabetical (ignoring case). */
export async function listExercises(): Promise<Exercise[]> {
  const records = await pb.collection('exercises').getFullList({ fields: 'id,name' });
  return records.map((r) => ({ id: r.id, name: r.name as string })).sort(byName);
}

/** Every entry with its workout's date and status, for the calc module. */
export async function listSessions(): Promise<SessionEntry[]> {
  const records = await pb.collection('entries').getFullList({
    expand: 'workout',
    fields: 'id,workout,exercise,position,sets,expand.workout.date,expand.workout.status',
  });
  return records.map((r) => {
    const workout = (r.expand as { workout: RecordModel }).workout;
    return {
      id: r.id,
      workout: r.workout as string,
      exercise: r.exercise as string,
      position: r.position as number,
      sets: r.sets as SetSlot[],
      date: workout.date as string,
      status: workout.status as Workout['status'],
    };
  });
}

function toWorkout(r: RecordModel): Workout {
  return { id: r.id, date: r.date as string, status: r.status as Workout['status'] };
}

/** The user's workout on a date, or null. */
export async function findWorkoutByDate(date: string): Promise<Workout | null> {
  const found = await pb.collection('workouts').getList(1, 1, { filter: pb.filter('date = {:date}', { date }) });
  const record = found.items[0];
  return record ? toWorkout(record) : null;
}

/**
 * Adds an exercise. If one with the same name already exists (ignoring
 * case and extra spaces), returns that one instead.
 */
export async function addExercise(userId: string, name: string): Promise<{ exercise: Exercise; existed: boolean }> {
  const normalized = normalizeExerciseName(name);
  const existing = await pb.collection('exercises').getList(1, 1, {
    filter: pb.filter('name:lower = {:name}', { name: normalized.toLowerCase() }),
    fields: 'id,name',
  });
  const found = existing.items[0];
  if (found) return { exercise: { id: found.id, name: found.name as string }, existed: true };
  const record = await pb.collection('exercises').create({ user: userId, name: normalized });
  return { exercise: { id: record.id, name: record.name as string }, existed: false };
}

export type StartResult = { started: true; workoutId: string } | { started: false; existing: Workout };

/**
 * Starts a draft workout on `date` with one entry per exercise, in the
 * given order, each prefilled from last time. Workout and entries are
 * created in one all-or-nothing batch request. If the date already has a
 * workout (e.g. started on another device meanwhile), nothing is created
 * and that workout is returned instead.
 */
export async function startWorkout(
  userId: string,
  date: string,
  exerciseIds: readonly string[],
  sessions: readonly Session[],
): Promise<StartResult> {
  const workoutId = newRecordId();
  const batch = pb.createBatch();
  batch.collection('workouts').create({ id: workoutId, user: userId, date, status: 'draft' });
  exerciseIds.forEach((exercise, position) => {
    batch.collection('entries').create({
      user: userId,
      workout: workoutId,
      exercise,
      position,
      sets: prefillSets(lastTime(sessions, exercise, date)),
    });
  });
  try {
    await batch.send();
    return { started: true, workoutId };
  } catch (err) {
    const existing = await findWorkoutByDate(date);
    if (existing) return { started: false, existing };
    throw err;
  }
}

export interface WorkoutDetail extends Workout {
  entries: { id: string; position: number; exercise: Exercise; sets: SetSlot[] }[];
}

/** A workout with its entries in order, and each entry's exercise. */
export async function getWorkout(id: string): Promise<WorkoutDetail> {
  const [workout, entries] = await Promise.all([
    pb.collection('workouts').getOne(id),
    pb.collection('entries').getFullList({
      filter: pb.filter('workout = {:id}', { id }),
      sort: 'position',
      expand: 'exercise',
    }),
  ]);
  return {
    ...toWorkout(workout),
    entries: entries.map((e) => {
      const exercise = (e.expand as { exercise: RecordModel }).exercise;
      return {
        id: e.id,
        position: e.position as number,
        exercise: { id: exercise.id, name: exercise.name as string },
        sets: e.sets as SetSlot[],
      };
    }),
  };
}

/**
 * Saves an entry's sets. `keepalive` lets the request finish while the page
 * is closing (used when the page is hidden or left).
 */
export async function saveEntrySets(entryId: string, sets: SetSlot[], options: { keepalive: boolean }): Promise<void> {
  await pb.collection('entries').update(entryId, { sets }, { keepalive: options.keepalive });
}

/**
 * Calls `onChange` whenever one of this workout's entries is added, changed
 * or removed on the server (from this or another device). API rules apply to
 * realtime too, so only the owner's changes arrive. Returns a function that
 * unsubscribes.
 */
export async function watchWorkoutEntries(
  workoutId: string,
  onChange: (action: string, entry: { id: string; exercise: string; sets: SetSlot[] }) => void,
): Promise<() => Promise<void>> {
  return pb.collection('entries').subscribe(
    '*',
    (e) =>
      onChange(e.action, { id: e.record.id, exercise: e.record.exercise as string, sets: e.record.sets as SetSlot[] }),
    { filter: pb.filter('workout = {:id}', { id: workoutId }) },
  );
}

export type DateChangeResult = { changed: true } | { changed: false; existing: Workout };

/**
 * Moves a workout to another date. One workout per date: if the date is
 * taken (checked first, and enforced by the server's unique index), nothing
 * changes and the workout on that date is returned.
 */
export async function changeWorkoutDate(id: string, date: string): Promise<DateChangeResult> {
  const taken = await findWorkoutByDate(date);
  if (taken && taken.id !== id) return { changed: false, existing: taken };
  try {
    await pb.collection('workouts').update(id, { date });
    return { changed: true };
  } catch (err) {
    const existing = await findWorkoutByDate(date);
    if (existing && existing.id !== id) return { changed: false, existing };
    throw err;
  }
}

/**
 * Adds an exercise to a workout, after its other entries, prefilled from
 * last time (before the workout's date), like starting a workout does.
 * Returns the new entry's id.
 */
export async function addEntry(
  userId: string,
  workout: { id: string; date: string; entries: readonly { position: number }[] },
  exerciseId: string,
  sessions: readonly Session[],
): Promise<string> {
  const position = Math.max(-1, ...workout.entries.map((e) => e.position)) + 1;
  const record = await pb.collection('entries').create({
    user: userId,
    workout: workout.id,
    exercise: exerciseId,
    position,
    sets: prefillSets(lastTime(sessions, exerciseId, workout.date)),
  });
  return record.id;
}

/** Switches an entry to another exercise; its sets stay as they are. */
export async function switchEntryExercise(entryId: string, exerciseId: string): Promise<void> {
  await pb.collection('entries').update(entryId, { exercise: exerciseId });
}

/** Removes an exercise (one entry, with its sets) from a workout. */
export async function removeEntry(entryId: string): Promise<void> {
  await pb.collection('entries').delete(entryId);
}

/** Marks a workout finished (the server records when). */
export async function finishWorkout(id: string): Promise<void> {
  await pb.collection('workouts').update(id, { status: 'finished' });
}

/** Deletes a workout; its entries go with it (cascade). */
export async function deleteWorkout(id: string): Promise<void> {
  await pb.collection('workouts').delete(id);
}

/** Calls `onChange` when this workout is finished or deleted (here or on another device). */
export async function watchWorkout(
  id: string,
  onChange: (action: string, workout: Workout) => void,
): Promise<() => Promise<void>> {
  return pb.collection('workouts').subscribe(id, (e) => onChange(e.action, toWorkout(e.record)));
}
