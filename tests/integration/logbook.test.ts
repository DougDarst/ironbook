import type PocketBase from 'pocketbase';
import { describe, expect, it } from 'vitest';
import { emptySets, type SetSlot } from '../../src/lib/model/sets';
import { MAX_EXERCISES_PER_WORKOUT } from '../../src/lib/model/workouts';
import { newRecordId } from '../../src/lib/workout';
import { client, newUser, statusOf, superuser, type TestUser } from './helpers';

// The logbook collections: exercises, workouts, entries.

let counter = 0;
const uniqueDate = () => {
  // A distinct valid date per call (tests share one server and run in parallel).
  counter += 1;
  const n = counter + Math.floor(Math.random() * 100_000);
  const year = 2000 + (n % 900);
  const month = String((n % 12) + 1).padStart(2, '0');
  const day = String((Math.floor(n / 12) % 28) + 1).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function sets(...filled: Partial<SetSlot>[]): SetSlot[] {
  return emptySets().map((slot, i) => ({ ...slot, ...(filled[i] ?? {}) }));
}

async function exercise(u: TestUser, name = `Lift ${crypto.randomUUID()}`) {
  return u.pb.collection('exercises').create({ user: u.id, name });
}

async function workout(u: TestUser, fields: Record<string, unknown> = {}) {
  return u.pb.collection('workouts').create({ user: u.id, date: uniqueDate(), status: 'draft', ...fields });
}

async function entry(u: TestUser, fields: Record<string, unknown> = {}) {
  const w = fields.workout ? null : await workout(u);
  const x = fields.exercise ? null : await exercise(u);
  return u.pb.collection('entries').create({
    user: u.id,
    workout: w?.id,
    exercise: x?.id,
    position: 0,
    sets: sets({ weight: 135, reps: 10, done: true }),
    ...fields,
  });
}

/** The server's message for a refused request, and the fields it names. */
async function refusal(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    const e = err as { status: number; response: { message: string; data: Record<string, unknown> } };
    return { status: e.status, message: e.response.message, fields: Object.keys(e.response.data ?? {}) };
  }
  throw new Error('Expected the request to be refused, but it succeeded');
}

async function twoUsers() {
  const admin = await superuser();
  return { admin, a: await newUser(admin, 'a'), b: await newUser(admin, 'b') };
}

describe('isolation between users', () => {
  for (const collection of ['exercises', 'workouts', 'entries'] as const) {
    it(`${collection}: another user can't see, change or delete them`, async () => {
      const { admin, a, b } = await twoUsers();
      const record = collection === 'exercises' ? await exercise(a) : collection === 'workouts' ? await workout(a) : await entry(a);

      expect((await b.pb.collection(collection).getFullList()).map((r) => r.id)).not.toContain(record.id);
      expect(await statusOf(b.pb.collection(collection).getOne(record.id))).toBe(404);
      expect(await statusOf(b.pb.collection(collection).update(record.id, { position: 5, name: 'x', status: 'finished' }))).toBe(404);
      expect(await statusOf(b.pb.collection(collection).delete(record.id))).toBe(404);
      expect((await client().collection(collection).getList()).totalItems).toBe(0);

      const after = await admin.collection(collection).getOne(record.id);
      expect(after.updated).toBe(record.updated); // untouched
    });

    it(`${collection}: nobody can create one for someone else, or hand one over`, async () => {
      const { a, b } = await twoUsers();
      const own = collection === 'exercises' ? await exercise(a) : collection === 'workouts' ? await workout(a) : await entry(a);
      expect(await statusOf(a.pb.collection(collection).update(own.id, { user: b.id }))).toBe(404);
      expect((await a.pb.collection(collection).getOne(own.id)).user).toBe(a.id);
    });
  }

  it("can't create records owned by another user", async () => {
    const { a, b } = await twoUsers();
    expect(await statusOf(a.pb.collection('exercises').create({ user: b.id, name: 'Sneaky' }))).toBe(400);
    expect(await statusOf(a.pb.collection('workouts').create({ user: b.id, date: uniqueDate(), status: 'draft' }))).toBe(400);
    expect((await b.pb.collection('exercises').getFullList()).length).toBe(0);
  });

  it("can't build an entry from another user's workout or exercise", async () => {
    const { a, b } = await twoUsers();
    const theirWorkout = await workout(a);
    const theirExercise = await exercise(a);
    const myWorkout = await workout(b);
    const myExercise = await exercise(b);

    expect(await refusal(entry(b, { workout: theirWorkout.id, exercise: myExercise.id }))).toMatchObject({
      status: 400,
      fields: ['workout'],
    });
    expect(await refusal(entry(b, { workout: myWorkout.id, exercise: theirExercise.id }))).toMatchObject({
      status: 400,
      fields: ['exercise'],
    });

    const mine = await entry(b, { workout: myWorkout.id, exercise: myExercise.id });
    expect(await refusal(b.pb.collection('entries').update(mine.id, { exercise: theirExercise.id }))).toMatchObject({
      status: 400,
      fields: ['exercise'],
    });
  });

  it('anonymous visitors can create nothing', async () => {
    const { a } = await twoUsers();
    expect(await statusOf(client().collection('exercises').create({ user: a.id, name: 'Anon' }))).toBe(400);
  });
});

describe('exercises', () => {
  it('stores names trimmed with whitespace collapsed', async () => {
    const { a } = await twoUsers();
    const x = await exercise(a, '  Barbell   Bench\tPress ');
    expect(x.name).toBe('Barbell Bench Press');
  });

  it('keeps names unique per user, ignoring case and spacing', async () => {
    const { a, b } = await twoUsers();
    await exercise(a, 'Barbell Bench Press');
    expect(await statusOf(exercise(a, 'barbell bench press'))).toBe(400);
    expect(await statusOf(exercise(a, '  BARBELL  BENCH PRESS'))).toBe(400);
    await exercise(b, 'Barbell Bench Press'); // another user may use the same name
    expect((await a.pb.collection('exercises').getFullList()).length).toBe(1);
  });

  it('keeps names unique when renaming too', async () => {
    const { a } = await twoUsers();
    await exercise(a, 'Squat');
    const deadlift = await exercise(a, 'Deadlift');
    expect(await statusOf(a.pb.collection('exercises').update(deadlift.id, { name: 'SQUAT' }))).toBe(400);
  });

  it('requires a name of at most 100 characters', async () => {
    const { a } = await twoUsers();
    expect(await statusOf(exercise(a, '   '))).toBe(400);
    expect(await statusOf(exercise(a, 'x'.repeat(101)))).toBe(400);
    await exercise(a, 'x'.repeat(100));
  });

  it("can't be deleted while an entry uses it; an unused one can", async () => {
    const { a } = await twoUsers();
    const used = await exercise(a);
    await entry(a, { exercise: used.id });
    expect(await statusOf(a.pb.collection('exercises').delete(used.id))).toBe(400);
    await a.pb.collection('exercises').getOne(used.id);

    const unused = await exercise(a);
    await a.pb.collection('exercises').delete(unused.id);
  });
});

describe('workouts', () => {
  it('allows one workout per user per date', async () => {
    const { a, b } = await twoUsers();
    const date = uniqueDate();
    await workout(a, { date });
    expect(await statusOf(workout(a, { date }))).toBe(400);
    await workout(b, { date }); // another user, same date: fine
  });

  it("refuses moving a workout onto a date that's taken", async () => {
    const { a } = await twoUsers();
    const taken = await workout(a);
    const other = await workout(a);
    expect(await statusOf(a.pb.collection('workouts').update(other.id, { date: taken.date }))).toBe(400);
    expect((await a.pb.collection('workouts').getOne(other.id)).date).toBe(other.date);
    const free = uniqueDate();
    await a.pb.collection('workouts').update(other.id, { date: free });
    expect((await a.pb.collection('workouts').getOne(other.id)).date).toBe(free);
  });

  it('requires a real YYYY-MM-DD date, explaining why', async () => {
    const { a } = await twoUsers();
    for (const date of ['2026-02-30', '2026-2-3', '2026-11-13T10:00:00Z', '13/11/2026', '']) {
      expect((await refusal(workout(a, { date }))).status, date).toBe(400);
    }
    expect(await refusal(workout(a, { date: '2026-02-30' }))).toEqual({
      status: 400,
      message: 'Date must be a real date as YYYY-MM-DD.',
      fields: ['date'],
    });
    await workout(a, { date: '2028-02-29' });
  });

  it('requires status draft or finished', async () => {
    const { a } = await twoUsers();
    expect(await statusOf(workout(a, { status: 'done' }))).toBe(400);
    expect(await statusOf(workout(a, { status: '' }))).toBe(400);
  });

  it('manages finished_at itself', async () => {
    const { a } = await twoUsers();
    const draft = await workout(a, { finished_at: '2020-01-01 00:00:00.000Z' });
    expect(draft.finished_at).toBe(''); // a draft has none, whatever the client sends

    const finished = await a.pb.collection('workouts').update(draft.id, { status: 'finished' });
    expect(finished.finished_at).not.toBe('');

    const edited = await a.pb.collection('workouts').update(draft.id, {
      date: uniqueDate(),
      finished_at: '2020-01-01 00:00:00.000Z',
    });
    expect(edited.finished_at).toBe(finished.finished_at); // kept while finished

    const reopened = await a.pb.collection('workouts').update(draft.id, { status: 'draft' });
    expect(reopened.finished_at).toBe('');
  });

  it('is finished at creation when created finished (as the import does)', async () => {
    const { a } = await twoUsers();
    expect((await workout(a, { status: 'finished' })).finished_at).not.toBe('');
  });

  it('deleting a workout deletes its entries', async () => {
    const { a } = await twoUsers();
    const e = await entry(a);
    await a.pb.collection('workouts').delete(e.workout);
    expect(await statusOf(a.pb.collection('entries').getOne(e.id))).toBe(404);
  });
});

describe('entries', () => {
  it('stores 20 set slots as given', async () => {
    const { a } = await twoUsers();
    const s = sets({ weight: 225, reps: 5, done: true }, { weight: 2.5, reps: 12 }, { reps: 8 });
    const e = await entry(a, { sets: s });
    expect(e.sets).toEqual(s);
  });

  it('refuses any other shape, explaining why', async () => {
    const { a } = await twoUsers();
    const w = await workout(a);
    const x = await exercise(a);
    const make = (s: unknown) => entry(a, { workout: w.id, exercise: x.id, sets: s });

    expect(await refusal(make(emptySets().slice(0, 19)))).toEqual({
      status: 400,
      message: 'Sets must have exactly 20 slots.',
      fields: ['sets'],
    });
    expect((await refusal(make(sets({ weight: 100, done: true })))).message).toBe(
      'Set 1: a done set needs both weight and reps.',
    );
    expect((await refusal(make(sets({}, { weight: 5000, reps: 1 })))).message).toBe('Set 2: weight must be 0–2000 lbs.');
    expect((await refusal(make(sets({ reps: 2.5 })))).message).toMatch(/whole number/);
    expect((await refusal(make('not json array'))).status).toBe(400);
    expect((await a.pb.collection('entries').getFullList()).length).toBe(0);
  });

  it('validates sets on update too', async () => {
    const { a } = await twoUsers();
    const e = await entry(a);
    expect(await statusOf(a.pb.collection('entries').update(e.id, { sets: emptySets().slice(0, 5) }))).toBe(400);
    expect((await a.pb.collection('entries').getOne(e.id)).sets).toEqual(e.sets);
  });

  it('allows an exercise once per workout', async () => {
    const { a } = await twoUsers();
    const e = await entry(a);
    expect(await statusOf(entry(a, { workout: e.workout, exercise: e.exercise, position: 1 }))).toBe(400);
  });

  it('may switch to another exercise, but not to another workout', async () => {
    const { a } = await twoUsers();
    const e = await entry(a);
    const other = await exercise(a);
    await a.pb.collection('entries').update(e.id, { exercise: other.id });
    expect((await a.pb.collection('entries').getOne(e.id)).exercise).toBe(other.id);

    const elsewhere = await workout(a);
    expect(await refusal(a.pb.collection('entries').update(e.id, { workout: elsewhere.id }))).toMatchObject({
      status: 400,
      fields: ['workout'],
    });
    // Sending the unchanged workout along with other fields is fine.
    await a.pb.collection('entries').update(e.id, { workout: e.workout, position: 3 });
  });

  it("can't switch to an exercise that's already in the workout", async () => {
    const { a } = await twoUsers();
    const first = await entry(a);
    const second = await entry(a, { workout: first.workout, position: 1 });
    expect(await statusOf(a.pb.collection('entries').update(second.id, { exercise: first.exercise }))).toBe(400);
    expect((await a.pb.collection('entries').getOne(second.id)).exercise).toBe(second.exercise);
  });

  it('removing an exercise from a workout keeps the workout and its other exercises', async () => {
    const { a, b } = await twoUsers();
    const first = await entry(a);
    const second = await entry(a, { workout: first.workout, position: 1 });
    expect(await statusOf(b.pb.collection('entries').delete(second.id))).toBe(404); // not someone else
    await a.pb.collection('entries').delete(second.id);
    expect(await statusOf(a.pb.collection('entries').getOne(second.id))).toBe(404);
    expect((await a.pb.collection('workouts').getOne(first.workout)).id).toBe(first.workout);
    expect((await a.pb.collection('entries').getOne(first.id)).sets).toEqual(first.sets);
  });
});

describe('batch requests', () => {
  async function startWorkout(pb: PocketBase, user: string, exerciseIds: string[], badSlotFor = -1) {
    const workoutId = Array.from({ length: 15 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
    const batch = pb.createBatch();
    batch.collection('workouts').create({ id: workoutId, user, date: uniqueDate(), status: 'draft' });
    exerciseIds.forEach((exercise, position) => {
      batch.collection('entries').create({
        user,
        workout: workoutId,
        exercise,
        position,
        sets: position === badSlotFor ? emptySets().slice(1) : emptySets(),
      });
    });
    return { workoutId, result: batch.send() };
  }

  it('create a workout and its entries in one request', async () => {
    const { a } = await twoUsers();
    const ids = [(await exercise(a)).id, (await exercise(a)).id, (await exercise(a)).id];
    const { workoutId, result } = await startWorkout(a.pb, a.id, ids);
    await result;
    const entries = await a.pb.collection('entries').getFullList({ filter: `workout = "${workoutId}"`, sort: 'position' });
    expect(entries.map((e) => e.exercise)).toEqual(ids);
  });

  it('create nothing if any part is invalid', async () => {
    const { a } = await twoUsers();
    const ids = [(await exercise(a)).id, (await exercise(a)).id];
    const { workoutId, result } = await startWorkout(a.pb, a.id, ids, 1);
    expect(await statusOf(result)).toBe(400);
    expect(await statusOf(a.pb.collection('workouts').getOne(workoutId))).toBe(404);
    expect((await a.pb.collection('entries').getFullList()).length).toBe(0);
  });
});

describe(`at most ${MAX_EXERCISES_PER_WORKOUT} exercises per workout`, () => {
  async function exercises(u: TestUser, count: number) {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) ids.push((await exercise(u)).id);
    return ids;
  }

  it('refuses a 21st entry, explaining why', async () => {
    const { a } = await twoUsers();
    const ids = await exercises(a, MAX_EXERCISES_PER_WORKOUT + 1);
    const w = await workout(a);
    for (const [position, id] of ids.slice(0, MAX_EXERCISES_PER_WORKOUT).entries()) {
      await entry(a, { workout: w.id, exercise: id, position });
    }
    expect(await refusal(entry(a, { workout: w.id, exercise: ids.at(-1), position: 20 }))).toEqual({
      status: 400,
      message: `A workout can have at most ${MAX_EXERCISES_PER_WORKOUT} exercises.`,
      fields: ['workout'],
    });
  });

  it('refuses a batch that would create 21, creating nothing', async () => {
    const { a } = await twoUsers();
    const ids = await exercises(a, MAX_EXERCISES_PER_WORKOUT + 1);
    const workoutId = newRecordId();
    const batch = a.pb.createBatch();
    batch.collection('workouts').create({ id: workoutId, user: a.id, date: uniqueDate(), status: 'draft' });
    ids.forEach((exercise, position) =>
      batch.collection('entries').create({ user: a.id, workout: workoutId, exercise, position, sets: emptySets() }),
    );
    expect(await statusOf(batch.send())).toBe(400);
    expect(await statusOf(a.pb.collection('workouts').getOne(workoutId))).toBe(404);
  });

  it(`counts per workout: another workout can have its own ${MAX_EXERCISES_PER_WORKOUT}`, async () => {
    const { a } = await twoUsers();
    const ids = await exercises(a, 2);
    const first = await workout(a);
    const second = await workout(a);
    await entry(a, { workout: first.id, exercise: ids[0] });
    await entry(a, { workout: second.id, exercise: ids[0] });
    await entry(a, { workout: second.id, exercise: ids[1], position: 1 });
  });
});

describe('deleting a user', () => {
  it('deletes all of their data', async () => {
    const { admin, a } = await twoUsers();
    const e = await entry(a);
    await admin.collection('users').delete(a.id);
    for (const [collection, id] of [
      ['entries', e.id],
      ['workouts', e.workout],
      ['exercises', e.exercise],
    ] as const) {
      expect(await statusOf(admin.collection(collection).getOne(id)), collection).toBe(404);
    }
  });
});
