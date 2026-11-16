import { mergeRemote, parseField, toText, toggledDone, withField, type Field } from '../entry';
import type { SetSlot } from '../model/sets';

/** Saves an entry's sets; rejects if the save failed. */
export type SaveSets = (entryId: string, sets: SetSlot[], options: { keepalive: boolean }) => Promise<void>;

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

/** Debounce after the last change (spec: about 700 ms). */
export const SAVE_DELAY_MS = 700;
/** Waits between retries after a failed save. */
export const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 30_000];

interface SlotText {
  weight: string;
  reps: string;
}

/**
 * One entry (an exercise in this workout) being edited on the Log screen.
 *
 * Holds what's typed in each field, the parsed sets, and saving:
 * - every change marks its slot dirty and saves SAVE_DELAY_MS after the last
 *   change; one save at a time, retried with backoff if it fails;
 * - a change from another device (realtime) is applied to every slot except
 *   those with unsaved local changes and the field being typed in.
 */
export class EntryEditor {
  readonly id: string;
  sets = $state<SetSlot[]>([]);
  text = $state<SlotText[]>([]);
  /** A message per slot when its typed value can't be used. */
  errors = $state<(string | null)[]>([]);
  status = $state<SaveStatus>('saved');

  /** The field being typed in, set by the screen. */
  focused: { slot: number; field: Field } | null = null;

  /** Slot → version of its latest change; cleared once that version is saved. */
  #dirty = new Map<number, number>();
  #version = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #saving: Promise<void> | null = null;
  #retries = 0;
  #save: SaveSets;

  constructor(id: string, sets: readonly SetSlot[], save: SaveSets) {
    this.id = id;
    this.#save = save;
    this.sets = sets.map((s) => ({ ...s }));
    this.text = sets.map((s) => ({ weight: toText(s.weight), reps: toText(s.reps) }));
    this.errors = sets.map(() => null);
  }

  get hasUnsaved(): boolean {
    return this.#dirty.size > 0;
  }

  /** The user typed in a field. Valid input updates the set; invalid shows a message. */
  type(slot: number, field: Field, value: string): void {
    this.text[slot] = { ...this.text[slot]!, [field]: value };
    const parsed = parseField(field, value);
    if (!parsed.ok) {
      this.errors[slot] = parsed.message;
      return;
    }
    // The slot's other field may still be invalid; keep its message if so.
    const other: Field = field === 'weight' ? 'reps' : 'weight';
    const otherParsed = parseField(other, this.text[slot]![other]);
    this.errors[slot] = otherParsed.ok ? null : otherParsed.message;
    const next = withField(this.sets[slot]!, field, parsed.value);
    if (next.weight === this.sets[slot]!.weight && next.reps === this.sets[slot]!.reps && next.done === this.sets[slot]!.done) {
      return; // e.g. "45" → "45." : same number
    }
    this.sets[slot] = next;
    this.#changed(slot);
  }

  /** The user left a field: show the stored value again if the text drifted (e.g. "45." → "45"). */
  blur(slot: number, field: Field): void {
    if (this.focused?.slot === slot && this.focused.field === field) this.focused = null;
    if (parseField(field, this.text[slot]![field]).ok) {
      this.text[slot] = { ...this.text[slot]!, [field]: toText(this.sets[slot]![field]) };
    }
  }

  toggleDone(slot: number): void {
    const next = toggledDone(this.sets[slot]!);
    if (next === this.sets[slot]) return;
    this.sets[slot] = next;
    this.#changed(slot);
  }

  /** Another device saved this entry: take its sets, except where we have local edits. */
  applyRemote(remote: readonly SetSlot[]): void {
    const keep = (i: number) => this.#dirty.has(i);
    this.sets = mergeRemote(this.sets, remote, keep);
    this.text = this.text.map((t, i) => {
      if (keep(i)) return t;
      const slot = this.sets[i]!;
      const focused = this.focused?.slot === i ? this.focused.field : null;
      // Never overwrite the field being typed in.
      return {
        weight: focused === 'weight' ? t.weight : toText(slot.weight),
        reps: focused === 'reps' ? t.reps : toText(slot.reps),
      };
    });
  }

  /** Saves now if anything is unsaved (leaving the screen, page hidden). */
  flush(keepalive = false): Promise<void> {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    return this.#dirty.size > 0 ? this.#run(keepalive) : Promise.resolve();
  }

  /** Stops pending timers (the screen is going away; call flush first). */
  dispose(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }

  #changed(slot: number): void {
    this.#dirty.set(slot, ++this.#version);
    if (this.status !== 'saving') this.status = 'unsaved';
    this.#schedule(SAVE_DELAY_MS);
  }

  #schedule(delay: number): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = null;
      void this.#run(false);
    }, delay);
  }

  async #run(keepalive: boolean): Promise<void> {
    // One save at a time; a change made meanwhile is saved right after.
    if (this.#saving) {
      await this.#saving;
      if (this.#dirty.size > 0 && !this.#timer) return this.#run(keepalive);
      return;
    }
    const snapshot = new Map(this.#dirty);
    const sets = this.sets.map((s) => ({ ...s }));
    this.status = 'saving';
    this.#saving = this.#save(this.id, sets, { keepalive })
      .then(() => {
        this.#retries = 0;
        for (const [slot, version] of snapshot) {
          if (this.#dirty.get(slot) === version) this.#dirty.delete(slot);
        }
      })
      .catch(() => {
        const delay = RETRY_DELAYS_MS[Math.min(this.#retries, RETRY_DELAYS_MS.length - 1)]!;
        this.#retries += 1;
        this.#schedule(delay);
      })
      .finally(() => {
        this.#saving = null;
      });
    await this.#saving;
    if (this.#retries > 0 && this.#dirty.size > 0) this.status = 'error';
    else if (this.#dirty.size > 0) {
      this.status = 'unsaved';
      if (!this.#timer) this.#schedule(SAVE_DELAY_MS);
    } else this.status = 'saved';
  }
}

/** One status for the whole screen: the worst of its entries'. */
export function overallStatus(statuses: readonly SaveStatus[]): SaveStatus {
  for (const s of ['error', 'saving', 'unsaved'] as const) if (statuses.includes(s)) return s;
  return 'saved';
}
