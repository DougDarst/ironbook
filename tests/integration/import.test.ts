import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';
import { describe, expect, it } from 'vitest';
import type { Session } from '../../src/lib/calc';
import { exportCsv, planImport, readCsv, type ExistingData } from '../../src/lib/csv';
import { runImport } from '../../src/lib/data/import';
import { emptySets, type SetSlot } from '../../src/lib/model/sets';
import { newUser, superuser, type TestUser } from './helpers';

// CSV import against a real PocketBase: the full round trip (export one
// user's data, import it into a fresh user: identical), and importing next
// to existing data. Rate limits are relaxed here; limits.test.ts runs an
// import under the production limits.

const TODAY = '2026-11-16';

function sets(...filled: (Partial<SetSlot> | null)[]): SetSlot[] {
  return emptySets().map((slot, i) => ({ ...slot, ...(filled[i] ?? {}) }));
}
const done = (weight: number, reps: number) => ({ weight, reps, done: true });

async function seed(u: TestUser, date: string, status: 'draft' | 'finished', entries: [string, SetSlot[]][]) {
  const workout = await u.pb.collection('workouts').create({ user: u.id, date, status });
  for (const [position, [exercise, s]] of entries.entries()) {
    await u.pb.collection('entries').create({ user: u.id, workout: workout.id, exercise, position, sets: s });
  }
  return workout.id;
}

/** A user's data as the app reads it. */
async function load(pb: PocketBase) {
  const exercises = (await pb.collection('exercises').getFullList()).map((e) => ({ id: e.id, name: e.name as string }));
  const records = await pb.collection('entries').getFullList({ expand: 'workout', sort: 'position' });
  const entries = records.map((r) => {
    const w = (r.expand as { workout: RecordModel }).workout;
    return {
      workout: r.workout as string,
      date: w.date as string,
      status: w.status as Session['status'],
      exercise: r.exercise as string,
      position: r.position as number,
      sets: r.sets as SetSlot[],
    };
  });
  return { exercises, entries, existing: { exercises, entries } satisfies ExistingData };
}

/** Finished entries as (exercise name, date, done sets in place), sorted: what an import must reproduce. */
function doneData(data: Awaited<ReturnType<typeof load>>) {
  const name = (id: string) => data.exercises.find((e) => e.id === id)!.name;
  return data.entries
    .filter((e) => e.status === 'finished')
    .map((e) => ({
      exercise: name(e.exercise),
      date: e.date,
      sets: e.sets.map((s) => (s.done ? s : { weight: null, reps: null, done: false })),
    }))
    .sort((a, b) => a.exercise.localeCompare(b.exercise) || a.date.localeCompare(b.date));
}

async function importText(u: TestUser, text: string) {
  const { entries, problems } = readCsv(text, TODAY);
  const plan = planImport(entries, (await load(u.pb)).existing);
  const saved = await runImport(u.pb, u.id, plan, undefined, 0);
  return { problems, plan, saved };
}

describe('CSV import', () => {
  it('round trip: exporting a user and importing into a fresh user gives identical data', async () => {
    const admin = await superuser();
    const a = await newUser(admin, 'export');
    const ex = async (name: string) => (await a.pb.collection('exercises').create({ user: a.id, name })).id;
    const squat = await ex('Barbell Squat');
    const curl = await ex('Curl, "EZ" bar');
    const press = await ex('Overhead Press');
    await seed(a, '2026-07-07', 'finished', [
      [squat, sets(done(1, 10), done(105, 5), { weight: 115, reps: 3, done: false }, done(115.25, 3))],
      [curl, sets(done(30, 12))],
    ]);
    await seed(a, '2026-07-11', 'finished', [
      [squat, sets(...Array.from({ length: 20 }, (_, i) => done(100 + i * 2.5, 5)))],
      [press, sets({ weight: 60, reps: 5, done: false })], // finished, but nothing done
    ]);
    await seed(a, '2026-07-20', 'draft', [[squat, sets(done(999, 9))]]); // drafts aren't exported

    const before = await load(a.pb);
    const csv = exportCsv(before.entries, before.exercises);

    const b = await newUser(admin, 'import');
    const { problems, plan, saved } = await importText(b, csv);
    expect(problems).toEqual([]);
    expect(plan.refused).toEqual([]);
    expect(saved).toBe(4);

    const after = await load(b.pb);
    expect(doneData(after)).toEqual(doneData(before));
    expect(after.exercises.map((e) => e.name).sort()).toEqual(['Barbell Squat', 'Curl, "EZ" bar', 'Overhead Press']);
    const workouts = await b.pb.collection('workouts').getFullList({ sort: 'date' });
    expect(workouts.map((w) => [w.date, w.status])).toEqual([
      ['2026-07-07', 'finished'],
      ['2026-07-11', 'finished'],
    ]);
    expect(workouts.every((w) => w.finished_at !== '')).toBe(true);
  });

  it('adds to existing data without overwriting it, and importing again changes nothing', async () => {
    const admin = await superuser();
    const u = await newUser(admin, 'existing');
    const squat = (await u.pb.collection('exercises').create({ user: u.id, name: 'Barbell Squat' })).id;
    const draft = await seed(u, '2026-07-07', 'draft', [[squat, sets(done(50, 5))]]);
    const file = [
      'EXERCISE,DATE,W1,R1',
      'barbell squat,7/7/26,105,5', // already logged that day: refused
      'Bench Press,7/7/26,135,8', // added to the existing draft
      'Barbell Squat,7/11/26,115,3', // a new finished workout
    ].join('\n');

    const first = await importText(u, file);
    expect(first.plan.refused).toEqual([{ row: 2, message: 'barbell squat on 7/7/26 is already logged.' }]);
    expect(first.saved).toBe(2);

    const data = await load(u.pb);
    const on = (date: string) => data.entries.filter((e) => e.date === date);
    expect(on('2026-07-07').map((e) => [e.workout, e.position, e.sets[0]!.weight])).toEqual([
      [draft, 0, 50], // untouched
      [draft, 1, 135],
    ]);
    expect((await u.pb.collection('workouts').getOne(draft)).status).toBe('draft'); // stays a draft
    expect(on('2026-07-11')).toHaveLength(1);
    expect(data.exercises).toHaveLength(2);

    const again = await importText(u, file);
    expect(again.saved).toBe(0);
    expect(again.plan.refused.map((r) => r.row)).toEqual([2, 3, 4]);
    expect((await load(u.pb)).entries).toHaveLength(3);
  });

  it('reports how far it got when a request fails', async () => {
    const admin = await superuser();
    const u = await newUser(admin, 'partial');
    const file = ['EXERCISE,DATE,W1,R1', 'Squat,7/7/26,100,5', 'Squat,7/11/26,100,5'].join('\n');
    const { entries } = readCsv(file, TODAY);
    const plan = planImport(entries, (await load(u.pb)).existing);
    // Another device logs Squat on 7/11 meanwhile: that workout can't be created.
    const squat = (await u.pb.collection('exercises').create({ user: u.id, name: 'Squat' })).id;
    await seed(u, '2026-07-11', 'finished', [[squat, sets(done(1, 1))]]);
    // Both workouts fit in one batch, which is all-or-nothing: nothing is saved.
    await expect(runImport(u.pb, u.id, plan, undefined, 0)).rejects.toMatchObject({ name: 'Error', done: 0 });
    expect((await load(u.pb)).entries).toHaveLength(1);
  });
});
