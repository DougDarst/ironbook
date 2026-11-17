import PocketBase from 'pocketbase';
import { describe, expect, inject, it } from 'vitest';
import { planImport, readCsv } from '../../src/lib/csv';
import { runImport } from '../../src/lib/data/import';
import { emptySets } from '../../src/lib/model/sets';
import { MAX_EXERCISES_PER_WORKOUT } from '../../src/lib/model/workouts';
import { newRecordId } from '../../src/lib/workout';
import { statusOf, TEST_PASSWORD, uniqueEmail } from './helpers';

// Runs against a server with the production rate limits (every other test
// server relaxes them). Limits are per IP and every test request comes from
// 127.0.0.1, so these tests run in order and pause between sign-ins.

const url = inject('pbStrictUrl');
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Sign-in attempts allow 2 per 3 seconds: wait out the window. */
const signInWindow = () => pause(3_100);

function client(): PocketBase {
  const pb = new PocketBase(url);
  pb.autoCancellation(false);
  return pb;
}

describe('production rate limits', () => {
  it('slow down password guessing: the third quick sign-in attempt is refused', async () => {
    await signInWindow();
    const attempt = () => client().collection('users').authWithPassword(uniqueEmail('guess'), 'wrong-password');
    const statuses = [await statusOf(attempt()), await statusOf(attempt()), await statusOf(attempt())];
    expect(statuses).toEqual([400, 400, 429]);
  });

  it('let a signed-in user create records in bulk (start workouts, import) and save quickly', async () => {
    await signInWindow();
    const creds = inject('superuser');
    const admin = client();
    await admin.collection('_superusers').authWithPassword(creds.email, creds.password);
    const email = uniqueEmail('limits');
    const user = await admin.collection('users').create({ email, password: TEST_PASSWORD, passwordConfirm: TEST_PASSWORD });
    const pb = client();
    await pb.collection('users').authWithPassword(email, TEST_PASSWORD);

    // Create the exercises as fast as the app could (e.g. adding them in the picker).
    const exercises: string[] = [];
    for (let i = 0; i < MAX_EXERCISES_PER_WORKOUT; i++) {
      exercises.push((await pb.collection('exercises').create({ user: user.id, name: `Lift ${i}` })).id);
    }

    // Start a workout with all of them in one batch, as the picker does.
    const workoutId = newRecordId();
    const batch = pb.createBatch();
    batch.collection('workouts').create({ id: workoutId, user: user.id, date: '2026-06-01', status: 'draft' });
    exercises.forEach((exercise, position) =>
      batch.collection('entries').create({ user: user.id, workout: workoutId, exercise, position, sets: emptySets() }),
    );
    await batch.send();

    // An import-sized burst: two more full workouts straight away (the CSV
    // import creates many records quickly). PocketBase counts creates per
    // collection, so this is 60 entries in a few seconds; its default limit
    // (20 per 5 s) would refuse the 21st.
    for (const date of ['2026-06-02', '2026-06-03']) {
      const id = newRecordId();
      const more = pb.createBatch();
      more.collection('workouts').create({ id, user: user.id, date, status: 'finished' });
      exercises.forEach((exercise, position) =>
        more.collection('entries').create({ user: user.id, workout: id, exercise, position, sets: emptySets() }),
      );
      await more.send();
    }

    // Autosave-like bursts of updates.
    const entries = await pb.collection('entries').getFullList({ filter: `workout = "${workoutId}"` });
    expect(entries).toHaveLength(MAX_EXERCISES_PER_WORKOUT);
    for (let i = 0; i < 30; i++) {
      const sets = emptySets();
      sets[0] = { weight: 100 + i, reps: 5, done: false };
      await pb.collection('entries').update(entries[i % entries.length]!.id, { sets });
    }
  });

  it('let a CSV import of a long history through, paced under the limits', async () => {
    await signInWindow();
    const creds = inject('superuser');
    const admin = client();
    await admin.collection('_superusers').authWithPassword(creds.email, creds.password);
    const email = uniqueEmail('import');
    const user = await admin.collection('users').create({ email, password: TEST_PASSWORD, passwordConfirm: TEST_PASSWORD });
    const pb = client();
    await pb.collection('users').authWithPassword(email, TEST_PASSWORD);

    // About two years of a 6-lift program: 100 workouts, 600 entries.
    const lifts = ['Squat', 'Bench', 'Deadlift', 'Press', 'Row', 'Curl'];
    const lines = ['EXERCISE,DATE,W1,R1,W2,R2'];
    for (let w = 0; w < 100; w++) {
      const date = `${(w % 12) + 1}/${(Math.floor(w / 12) % 28) + 1}/${String(24 + Math.floor(w / 336)).padStart(2, '0')}`;
      for (const lift of lifts) lines.push(`${lift},${date},${100 + w},5,${110 + w},3`);
    }
    const { entries, problems } = readCsv(lines.join('\n'), '2026-11-16');
    expect(problems).toEqual([]);
    const plan = planImport(entries, { exercises: [], entries: [] });
    expect(plan.entryCount).toBe(600);

    const progress: number[] = [];
    expect(await runImport(pb, user.id, plan, (p) => progress.push(p.done))).toBe(600);
    expect(progress.at(-1)).toBe(600);
    expect(await pb.collection('entries').getList(1, 1)).toMatchObject({ totalItems: 600 });
  }, 120_000);
});
