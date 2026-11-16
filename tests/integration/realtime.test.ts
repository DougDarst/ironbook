import type { RecordSubscription } from 'pocketbase';
import { describe, expect, it } from 'vitest';
import { emptySets } from '../../src/lib/model/sets';
import { newUser, superuser, type TestUser } from './helpers';

// Realtime (used by the Log screen to show changes from another device):
// API rules apply to subscriptions, so a user only hears about their own
// records.

async function entryFor(u: TestUser) {
  const exercise = await u.pb.collection('exercises').create({ user: u.id, name: `Lift ${crypto.randomUUID()}` });
  const workout = await u.pb.collection('workouts').create({ user: u.id, date: '2026-03-03', status: 'draft' });
  return u.pb.collection('entries').create({ user: u.id, workout: workout.id, exercise: exercise.id, position: 0, sets: emptySets() });
}

/** Subscribes `u` to every entry change; returns the events seen and a stop function. */
async function listen(u: TestUser, filter?: string) {
  const seen: RecordSubscription[] = [];
  const stop = await u.pb.collection('entries').subscribe('*', (e) => seen.push(e), filter ? { filter } : {});
  return { seen, stop };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('realtime', () => {
  it("delivers a user's own changes, with the new sets", async () => {
    const admin = await superuser();
    const a = await newUser(admin, 'a');
    const entry = await entryFor(a);
    const { seen, stop } = await listen(a, `workout = "${entry.workout}"`);
    const sets = emptySets();
    sets[0] = { weight: 100, reps: 5, done: true };
    await a.pb.collection('entries').update(entry.id, { sets });
    await expect.poll(() => seen.length).toBe(1);
    expect(seen[0]!.action).toBe('update');
    expect(seen[0]!.record.sets[0]).toEqual({ weight: 100, reps: 5, done: true });
    await stop();
  });

  it("never delivers another user's changes", async () => {
    const admin = await superuser();
    const a = await newUser(admin, 'a');
    const b = await newUser(admin, 'b');
    const theirs = await entryFor(b);
    const mine = await entryFor(a);
    const { seen, stop } = await listen(a); // everything a is allowed to see
    await b.pb.collection('entries').update(theirs.id, { sets: emptySets().map((s) => ({ ...s, weight: 1 })) });
    await a.pb.collection('entries').update(mine.id, { position: 1 }); // a control event
    await expect.poll(() => seen.length).toBeGreaterThanOrEqual(1);
    await wait(300);
    expect(seen.map((e) => e.record.id)).toEqual([mine.id]);
    await stop();
  });

  it("can't be pointed at another user's workout with a filter", async () => {
    const admin = await superuser();
    const a = await newUser(admin, 'a');
    const b = await newUser(admin, 'b');
    const theirs = await entryFor(b);
    const { seen, stop } = await listen(a, `workout = "${theirs.workout}"`);
    await b.pb.collection('entries').update(theirs.id, { position: 2 });
    await wait(500);
    expect(seen).toEqual([]);
    await stop();
  });
});
