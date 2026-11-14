/**
 * Volume of one entry's sets. Pure and dependency-free.
 *
 * Arithmetic is exact: weights (at most 2 decimals) are converted to
 * hundredths of a pound before multiplying, so floating-point noise
 * (0.1 + 0.2) can't creep into totals.
 */
import type { SetSlot } from '../model/sets';

/** A slot's weight × reps in hundredths of a pound, or 0 if either is empty. */
function slotHundredths(slot: SetSlot): number {
  if (slot.weight === null || slot.reps === null) return 0;
  return Math.round(slot.weight * 100) * slot.reps;
}

function sum(slots: readonly SetSlot[], include: (slot: SetSlot) => boolean): number {
  let total = 0;
  for (const slot of slots) if (include(slot)) total += slotHundredths(slot);
  return total / 100;
}

/** weight × reps of one slot (whether or not it's done). */
export function setVolume(slot: SetSlot): number {
  return slotHundredths(slot) / 100;
}

/** "Lifted": weight × reps over the done sets. This is an entry's volume. */
export function doneVolume(slots: readonly SetSlot[]): number {
  return sum(slots, (slot) => slot.done);
}

/** "Planned": weight × reps over every slot with both numbers, done or not. */
export function plannedVolume(slots: readonly SetSlot[]): number {
  return sum(slots, () => true);
}

/** How many slots are ticked done. */
export function doneCount(slots: readonly SetSlot[]): number {
  return slots.filter((slot) => slot.done).length;
}

export interface GroupVolume {
  /** Volume of the group's done sets. */
  done: number;
  /** Volume of every slot in the group with both numbers. */
  total: number;
}

/** Done and total volume for each group of `size` slots (groups of 5 on the Log screen). */
export function groupVolumes(slots: readonly SetSlot[], size = 5): GroupVolume[] {
  const groups: GroupVolume[] = [];
  for (let start = 0; start < slots.length; start += size) {
    const group = slots.slice(start, start + size);
    groups.push({ done: doneVolume(group), total: plannedVolume(group) });
  }
  return groups;
}
