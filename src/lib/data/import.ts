/**
 * Carries out an import plan (src/lib/csv/import-plan.ts): creates the new
 * exercises, then the workouts and entries in batch requests, paced to stay
 * under the server's rate limits. Takes the PocketBase client as a
 * parameter so the integration tests can run it against a real server.
 */
import type PocketBase from 'pocketbase';
import type { ImportPlan } from '../csv';
import { normalizeExerciseName } from '../model/exercises';
import { newRecordId } from '../workout';

/** Most requests in one batch (PocketBase's default limit is 50). */
export const BATCH_SIZE = 50;
/**
 * Time between batch requests. The server allows 3 batch requests a second
 * and 500 creates per 5 seconds (each create in a batch counts): 50 creates
 * every 0.6 s is about 417 per 5 s.
 */
export const BATCH_INTERVAL_MS = 600;

export interface ImportProgress {
  done: number;
  total: number;
}

/** The import stopped part-way; `done` entries were saved (importing the file again skips them). */
export class ImportStopped extends Error {
  constructor(
    readonly done: number,
    readonly cause: unknown,
  ) {
    super(`Import stopped after ${done} entries`);
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The id of the exercise with this name, creating it if needed (another device may have just added it). */
async function exerciseId(pb: PocketBase, userId: string, name: string): Promise<string> {
  const normalized = normalizeExerciseName(name);
  const find = async () => {
    const found = await pb.collection('exercises').getList(1, 1, {
      filter: pb.filter('name:lower = {:name}', { name: normalized.toLowerCase() }),
      fields: 'id',
    });
    return found.items[0]?.id ?? null;
  };
  const existing = await find();
  if (existing) return existing;
  try {
    return (await pb.collection('exercises').create({ user: userId, name: normalized })).id;
  } catch (err) {
    const raced = await find();
    if (raced) return raced;
    throw err;
  }
}

/**
 * Imports `plan` for `userId`. New workouts are created finished, with
 * their entries in the same all-or-nothing batch; entries for an existing
 * workout are added to it. Reports progress after each batch. If a request
 * fails, stops and throws ImportStopped with the number of entries saved.
 */
export async function runImport(
  pb: PocketBase,
  userId: string,
  plan: ImportPlan,
  onProgress: (progress: ImportProgress) => void = () => {},
  interval = BATCH_INTERVAL_MS,
): Promise<number> {
  const total = plan.entryCount;
  let done = 0;
  try {
    const ids = new Map<string, string>();
    for (const name of plan.newExercises) ids.set(name.toLowerCase(), await exerciseId(pb, userId, name));

    // Each workout's requests stay together, so a new workout and its
    // entries are created all at once or not at all.
    type Request = { collection: 'workouts' | 'entries'; body: Record<string, unknown> };
    const units: Request[][] = plan.workouts.map((w) => {
      const workout = w.workoutId ?? newRecordId();
      const requests: Request[] = w.workoutId
        ? []
        : [{ collection: 'workouts', body: { id: workout, user: userId, date: w.date, status: 'finished' } }];
      for (const e of w.entries) {
        const exercise = e.exerciseId ?? ids.get(e.exercise.toLowerCase())!;
        requests.push({
          collection: 'entries',
          body: { user: userId, workout, exercise, position: e.position, sets: e.sets },
        });
      }
      return requests;
    });
    const batches: Request[][] = [];
    for (const unit of units) {
      const last = batches.at(-1);
      if (last && last.length + unit.length <= BATCH_SIZE) last.push(...unit);
      else batches.push([...unit]);
    }

    let lastSent = 0;
    for (const requests of batches) {
      const gap = lastSent + interval - Date.now();
      if (gap > 0) await wait(gap);
      lastSent = Date.now();
      const batch = pb.createBatch();
      for (const r of requests) batch.collection(r.collection).create(r.body);
      await batch.send();
      done += requests.filter((r) => r.collection === 'entries').length;
      onProgress({ done, total });
    }
    return done;
  } catch (err) {
    throw new ImportStopped(done, err);
  }
}
