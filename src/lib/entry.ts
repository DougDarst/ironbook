/**
 * Editing an entry's set slots on the Log screen: parsing typed input, the
 * done rules, and merging a change from another device. Pure functions,
 * unit-tested in entry.test.ts.
 */
import { MAX_REPS, MAX_WEIGHT, type SetSlot } from './model/sets';

export type Field = 'weight' | 'reps';

export type Parsed = { ok: true; value: number | null } | { ok: false; message: string };

/**
 * A typed weight: empty means no weight; otherwise lbs, 0–2000, up to 2
 * decimals. A decimal comma is accepted ("2,5"), as some keypads offer it.
 */
export function parseWeight(text: string): Parsed {
  const t = text.trim().replace(',', '.');
  if (t === '') return { ok: true, value: null };
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(t)) return { ok: false, message: 'Weight must be a number.' };
  const value = Number(t);
  if (value > MAX_WEIGHT) return { ok: false, message: `Weight can be at most ${MAX_WEIGHT} lbs.` };
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) {
    return { ok: false, message: 'Weight can have at most 2 decimals.' };
  }
  return { ok: true, value };
}

/** Typed reps: empty means no reps; otherwise a whole number, 0–999. */
export function parseReps(text: string): Parsed {
  const t = text.trim();
  if (t === '') return { ok: true, value: null };
  if (!/^\d+$/.test(t)) return { ok: false, message: 'Reps must be a whole number.' };
  const value = Number(t);
  if (value > MAX_REPS) return { ok: false, message: `Reps can be at most ${MAX_REPS}.` };
  return { ok: true, value };
}

export function parseField(field: Field, text: string): Parsed {
  return field === 'weight' ? parseWeight(text) : parseReps(text);
}

/** How a stored number shows in its input: 225 → "225", 2.5 → "2.5", null → "". */
export function toText(value: number | null): string {
  return value === null ? '' : String(value);
}

/** Whether a slot can be ticked done: it needs both weight and reps. */
export function canBeDone(slot: SetSlot): boolean {
  return slot.weight !== null && slot.reps !== null;
}

/**
 * A slot with one field changed. Clearing a field of a done slot also
 * un-ticks it (a done set needs both numbers).
 */
export function withField(slot: SetSlot, field: Field, value: number | null): SetSlot {
  const next = { ...slot, [field]: value };
  return canBeDone(next) ? next : { ...next, done: false };
}

/** A slot with done flipped; unchanged if it can't be done. */
export function toggledDone(slot: SetSlot): SetSlot {
  if (!slot.done && !canBeDone(slot)) return slot;
  return { ...slot, done: !slot.done };
}

/**
 * Applies another device's version of the sets, keeping the slots for
 * which `keepLocal(i)` is true (slots with unsaved local changes). Returns
 * a new array; untouched slots are the remote ones.
 */
export function mergeRemote(
  local: readonly SetSlot[],
  remote: readonly SetSlot[],
  keepLocal: (index: number) => boolean,
): SetSlot[] {
  return local.map((slot, i) => (keepLocal(i) ? slot : { ...(remote[i] ?? slot) }));
}

/** Where Next/Enter goes from a field: weight → reps → next set's weight; null after the last. */
export function nextField(slot: number, field: Field, slots: number): { slot: number; field: Field } | null {
  if (field === 'weight') return { slot, field: 'reps' };
  return slot + 1 < slots ? { slot: slot + 1, field: 'weight' } : null;
}

/** Sets with both numbers entered but not ticked: they won't count if the workout is finished. */
export function untickedCount(slots: readonly SetSlot[]): number {
  return slots.filter((slot) => !slot.done && canBeDone(slot)).length;
}

/**
 * For each slot, whether its weight is heavier than the nearest set above
 * it that has a weight (spec Decisions, 2026-11-20): marked yellow on the
 * Log screen, for prefilled and typed values alike. Set 1, slots without a
 * weight, and sets with no weight above them are never marked; neither is
 * a lighter or equal weight.
 */
export function heavierThanAbove(slots: readonly SetSlot[]): boolean[] {
  let above: number | null = null;
  return slots.map((slot) => {
    if (slot.weight === null) return false;
    const heavier = above !== null && slot.weight > above;
    above = slot.weight;
    return heavier;
  });
}
