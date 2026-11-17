import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptySets, type SetSlot } from '../model/sets';
import { EntryEditor, overallStatus, RETRY_DELAYS_MS, SAVE_DELAY_MS, type SaveSets } from './entry-editor.svelte';

/** A fake save: records calls; each call's promise is settled by the test. */
function fakeSave() {
  const calls: { sets: SetSlot[]; resolve: () => void; reject: () => void }[] = [];
  const save: SaveSets = (_id, sets) =>
    new Promise<void>((resolve, reject) => calls.push({ sets, resolve, reject: () => reject(new Error('offline')) }));
  return { save, calls };
}

/** Lets pending promise callbacks run. */
const settle = () => vi.advanceTimersByTimeAsync(0);

function start(sets: SetSlot[] = emptySets()) {
  const fake = fakeSave();
  return { editor: new EntryEditor('entry1', sets, fake.save), calls: fake.calls };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('typing', () => {
  it('updates the set from valid text and keeps the text as typed', () => {
    const { editor } = start();
    editor.type(0, 'weight', '2,5');
    editor.type(0, 'reps', '10');
    expect(editor.sets[0]).toEqual({ weight: 2.5, reps: 10, done: false });
    expect(editor.text[0]).toEqual({ weight: '2,5', reps: '10' });
    expect(editor.errors[0]).toBeNull();
  });

  it('shows a message for invalid text and leaves the set alone', () => {
    const { editor } = start();
    editor.type(0, 'weight', '100');
    editor.type(0, 'weight', '100.555');
    expect(editor.errors[0]).toBe('Weight can have at most 2 decimals.');
    expect(editor.sets[0]!.weight).toBe(100);
  });

  it('keeps the other field’s message until it is fixed too', () => {
    const { editor } = start();
    editor.type(0, 'reps', '5.5');
    editor.type(0, 'weight', '100');
    expect(editor.errors[0]).toBe('Reps must be a whole number.');
    editor.type(0, 'reps', '5');
    expect(editor.errors[0]).toBeNull();
  });

  it('tidies the text when leaving the field', () => {
    const { editor } = start();
    editor.type(0, 'weight', '45.');
    editor.blur(0, 'weight');
    expect(editor.text[0]!.weight).toBe('45');
  });

  it('un-ticks a done set whose number is cleared', () => {
    const sets = emptySets();
    sets[0] = { weight: 100, reps: 5, done: true };
    const { editor } = start(sets);
    editor.type(0, 'reps', '');
    expect(editor.sets[0]).toEqual({ weight: 100, reps: null, done: false });
  });

  it('does not tick an incomplete set', () => {
    const { editor } = start();
    editor.type(0, 'weight', '100');
    editor.toggleDone(0);
    expect(editor.sets[0]!.done).toBe(false);
    expect(editor.hasUnsaved).toBe(true); // from the weight, not the tick
  });
});

describe('autosave', () => {
  it(`saves once, ${SAVE_DELAY_MS} ms after the last change`, async () => {
    const { editor, calls } = start();
    editor.type(0, 'weight', '1');
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS - 100);
    editor.type(0, 'weight', '13');
    editor.type(0, 'weight', '135');
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS - 1);
    expect(calls).toHaveLength(0);
    expect(editor.status).toBe('unsaved');
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.sets[0]!.weight).toBe(135);
    expect(editor.status).toBe('saving');
    calls[0]!.resolve();
    await settle();
    expect(editor.status).toBe('saved');
    expect(editor.hasUnsaved).toBe(false);
  });

  it('does not save when nothing changed', async () => {
    const { editor, calls } = start();
    editor.type(0, 'weight', '');
    editor.toggleDone(0);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 3);
    expect(calls).toHaveLength(0);
  });

  it('never runs two saves at once, and saves a change made during a save', async () => {
    const { editor, calls } = start();
    editor.type(0, 'weight', '100');
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(calls).toHaveLength(1);

    editor.type(1, 'weight', '110'); // while the first save is in flight
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 2);
    expect(calls).toHaveLength(1);

    calls[0]!.resolve();
    await settle();
    expect(editor.hasUnsaved).toBe(true); // slot 1 wasn't in the first save
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.sets[1]!.weight).toBe(110);
    calls[1]!.resolve();
    await settle();
    expect(editor.status).toBe('saved');
  });

  it('retries a failed save with backoff and shows the error meanwhile', async () => {
    const { editor, calls } = start();
    editor.type(0, 'weight', '100');
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    calls[0]!.reject();
    await settle();
    expect(editor.status).toBe('error');
    expect(editor.hasUnsaved).toBe(true);

    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]! - 1);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(2);
    calls[1]!.reject();
    await settle();
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1]!);
    expect(calls).toHaveLength(3);
    calls[2]!.resolve();
    await settle();
    expect(editor.status).toBe('saved');
  });

  it('stops saving for good once discarded, even a failed save under way', async () => {
    const { editor, calls } = start();
    editor.type(0, 'weight', '100');
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(calls).toHaveLength(1);
    editor.discard();
    calls[0]!.reject(); // e.g. the entry was deleted
    await settle();
    editor.type(0, 'weight', '110');
    await editor.flush();
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS.reduce((a, b) => a + b) + SAVE_DELAY_MS);
    expect(calls).toHaveLength(1); // no retry, no new save
  });

  it('flush saves immediately, with keepalive when leaving', async () => {
    const seen: boolean[] = [];
    const editor = new EntryEditor('e', emptySets(), async (_id, _sets, { keepalive }) => {
      seen.push(keepalive);
    });
    editor.type(0, 'weight', '100');
    await editor.flush(true);
    expect(seen).toEqual([true]);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 2);
    expect(seen).toEqual([true]); // the pending debounce was cancelled
    await editor.flush();
    expect(seen).toEqual([true]); // nothing left to save
  });
});

describe('changes from another device', () => {
  function remoteWith(...filled: [number, SetSlot][]) {
    const sets = emptySets();
    for (const [i, slot] of filled) sets[i] = slot;
    return sets;
  }

  it('are applied to slots without local edits, updating their text', () => {
    const { editor } = start();
    editor.applyRemote(remoteWith([2, { weight: 50, reps: 12, done: true }]));
    expect(editor.sets[2]).toEqual({ weight: 50, reps: 12, done: true });
    expect(editor.text[2]).toEqual({ weight: '50', reps: '12' });
  });

  it('never overwrite a slot with unsaved local edits', async () => {
    const { editor, calls } = start();
    editor.type(0, 'weight', '100');
    editor.applyRemote(remoteWith([0, { weight: 999, reps: 1, done: false }], [1, { weight: 5, reps: 5, done: false }]));
    expect(editor.sets[0]!.weight).toBe(100);
    expect(editor.text[0]!.weight).toBe('100');
    expect(editor.sets[1]!.weight).toBe(5);
    // The save that follows carries both: ours and theirs.
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(calls[0]!.sets[0]!.weight).toBe(100);
    expect(calls[0]!.sets[1]!.weight).toBe(5);
  });

  it('never overwrite the text of the field being typed in', () => {
    const { editor } = start();
    editor.focused = { slot: 3, field: 'reps' };
    editor.applyRemote(remoteWith([3, { weight: 80, reps: 9, done: false }]));
    expect(editor.text[3]).toEqual({ weight: '80', reps: '' }); // weight updates, reps text kept
    expect(editor.sets[3]).toEqual({ weight: 80, reps: 9, done: false });
    editor.blur(3, 'reps');
    expect(editor.text[3]!.reps).toBe('9'); // shown once the user leaves the field
  });

  it('protects a slot again once it changes after a save', async () => {
    const { editor, calls } = start();
    editor.type(0, 'weight', '100');
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    calls[0]!.resolve();
    await settle();
    editor.applyRemote(remoteWith([0, { weight: 120, reps: null, done: false }])); // e.g. our own echo, or theirs
    expect(editor.sets[0]!.weight).toBe(120);
  });
});

describe('overallStatus', () => {
  it('shows the worst status', () => {
    expect(overallStatus(['saved', 'saved'])).toBe('saved');
    expect(overallStatus(['saved', 'unsaved'])).toBe('unsaved');
    expect(overallStatus(['unsaved', 'saving'])).toBe('saving');
    expect(overallStatus(['saving', 'error', 'saved'])).toBe('error');
    expect(overallStatus([])).toBe('saved');
  });
});
