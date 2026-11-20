/**
 * Reading one session's sets for the History redesign (spec Decisions,
 * 2026-11-20): the top set, repeated sets grouped
 * into one chip, and the warm-up ramp. Done sets only. Pure and
 * dependency-free.
 */
import type { SetSlot } from '../model/sets';

/** A done set: its weight and reps. */
export interface LiftedSet {
  weight: number;
  reps: number;
}

/** A run of identical consecutive sets: `count` sets of `reps` at `weight`. */
export interface SetGroup extends LiftedSet {
  count: number;
}

/**
 * The done sets, in order. Sets that weren't done are left out (History
 * shows only what was lifted), so the sets either side of one count as
 * consecutive.
 */
export function liftedSets(slots: readonly SetSlot[]): LiftedSet[] {
  const sets: LiftedSet[] = [];
  for (const s of slots) if (s.done && s.weight !== null && s.reps !== null) sets.push({ weight: s.weight, reps: s.reps });
  return sets;
}

/**
 * The top set: the highest weight lifted, with the most reps done at that
 * weight (e.g. 205 × 5). Null when nothing was lifted.
 */
export function topSet(slots: readonly SetSlot[]): LiftedSet | null {
  let top: LiftedSet | null = null;
  for (const s of liftedSets(slots)) {
    if (!top || s.weight > top.weight || (s.weight === top.weight && s.reps > top.reps)) top = s;
  }
  return top;
}

/**
 * Consecutive sets with the same weight and reps merged into one group with
 * a count (195 × 4 five times → { 195, 4, count 5 }). Only consecutive sets
 * merge: 195 × 4, 205 × 3, 195 × 4 stays three groups.
 */
export function groupSets(sets: readonly LiftedSet[]): SetGroup[] {
  const groups: SetGroup[] = [];
  for (const s of sets) {
    const last = groups.at(-1);
    if (last && last.weight === s.weight && last.reps === s.reps) last.count += 1;
    else groups.push({ weight: s.weight, reps: s.reps, count: 1 });
  }
  return groups;
}

/**
 * A set counts as warm-up when it's at or below this share of the day's top
 * weight (spec Decisions, 2026-11-20).
 */
export const RAMP_SHARE = 0.75;

export interface RampSplit {
  /** The leading warm-up sets (at or below RAMP_SHARE of the top weight). */
  ramp: LiftedSet[];
  /** Everything from the first heavier set on, in order. */
  work: LiftedSet[];
}

/**
 * Splits a session's done sets into its warm-up ramp and its working sets.
 * The ramp is the run of *leading* sets at or below 75% of the top weight;
 * a light set after a working set stays a working set (a back-off set). With
 * no weight (bodyweight work, top weight 0) there is no ramp.
 */
export function splitRamp(slots: readonly SetSlot[]): RampSplit {
  const sets = liftedSets(slots);
  const top = topSet(slots);
  if (!top || top.weight <= 0) return { ramp: [], work: sets };
  const limit = top.weight * RAMP_SHARE;
  let n = 0;
  while (n < sets.length && sets[n]!.weight <= limit) n += 1;
  return { ramp: sets.slice(0, n), work: sets.slice(n) };
}
