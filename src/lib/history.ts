/**
 * The History screen's content: one section per exercise, its finished
 * sessions oldest first, with month dividers. Pure functions, unit-tested in
 * history.test.ts. Volume, change and PRs come from the calc module.
 */
import { exerciseHistory, groupSets, splitRamp, topSet, type Change, type LiftedSet, type Session } from './calc';
import { formatWeight } from './format';
import { monthOf } from './model/dates';
import type { SetSlot } from './model/sets';

export interface HistorySession extends Session {
  /** The workout's id, to open it for editing. */
  workout: string;
}

export interface HistoryRow {
  kind: 'session';
  date: string;
  workout: string;
  /** The session's set slots (shown as chips, see setChips). */
  sets: readonly SetSlot[];
  volume: number;
  change: Change | null;
  isPR: boolean;
}

export interface MonthRow {
  kind: 'month';
  /** "YYYY-MM". */
  month: string;
}

export interface HistorySection {
  exercise: { id: string; name: string };
  rows: (MonthRow | HistoryRow)[];
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "2026-09" → "September 2026". */
export function monthLabel(month: string): string {
  return `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

/** "2026-09-01" → "9/1/26", as in the sheet. */
export function sheetDate(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}/${date.slice(2, 4)}`;
}

/** How the History sets are shown (the toolbar's two toggles). */
export interface SetView {
  /** Show each warm-up set, or one "Ramp 45→145 · 11 sets" chip. */
  showRamp: boolean;
  /** Merge consecutive identical sets into one chip with a count. */
  grouped: boolean;
}

/** One chip in the Sets column. */
export type SetChip =
  /** The warm-up ramp, collapsed: its first and last weight and how many sets. */
  | { kind: 'ramp'; first: number; last: number; sets: number }
  /** One set, or `count` identical consecutive sets. Top = the day's top weight. */
  | { kind: 'set'; weight: number; reps: number; count: number; tone: 'ramp' | 'work' | 'top' };

/**
 * A session's done sets as chips: the warm-up ramp (collapsed into one chip,
 * or shown set by set), then the working sets; repeated sets grouped when
 * `grouped`. Working sets at the day's top weight are tinted (tone "top").
 */
export function setChips(slots: readonly SetSlot[], view: SetView): SetChip[] {
  const { ramp, work } = splitRamp(slots);
  const topWeight = topSet(slots)?.weight ?? null;
  const toChips = (sets: LiftedSet[], tone: (s: LiftedSet) => 'ramp' | 'work' | 'top'): SetChip[] =>
    (view.grouped ? groupSets(sets) : sets.map((s) => ({ ...s, count: 1 }))).map((g) => ({
      kind: 'set',
      weight: g.weight,
      reps: g.reps,
      count: g.count,
      tone: tone(g),
    }));
  const rampChips: SetChip[] =
    ramp.length === 0
      ? []
      : view.showRamp
        ? toChips(ramp, () => 'ramp')
        : [{ kind: 'ramp', first: ramp[0]!.weight, last: ramp.at(-1)!.weight, sets: ramp.length }];
  return [...rampChips, ...toChips(work, (s) => (s.weight === topWeight ? 'top' : 'work'))];
}

/** A chip's text: "195 × 4" with "×5" for a group; "Ramp 45→145" with "11 sets". */
export function chipText(chip: SetChip): { label: string; extra: string | null } {
  if (chip.kind === 'ramp') {
    const range = chip.first === chip.last ? formatWeight(chip.first) : `${formatWeight(chip.first)}→${formatWeight(chip.last)}`;
    return { label: `Ramp ${range}`, extra: `${chip.sets} ${chip.sets === 1 ? 'set' : 'sets'}` };
  }
  return { label: `${formatWeight(chip.weight)} × ${chip.reps}`, extra: chip.count > 1 ? `×${chip.count}` : null };
}

/**
 * Sections for the given exercises (alphabetical, ignoring case), skipping
 * those with no finished sessions. Pass one exercise to filter. Drafts never
 * appear; a month divider starts each month.
 */
export function buildHistory(
  sessions: readonly HistorySession[],
  exercises: readonly { id: string; name: string }[],
): HistorySection[] {
  const sorted = [...exercises].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const sections: HistorySection[] = [];
  for (const exercise of sorted) {
    const history = exerciseHistory(sessions, exercise.id);
    if (history.length === 0) continue;
    const rows: (MonthRow | HistoryRow)[] = [];
    let month = '';
    for (const { session, volume, change, isPR } of history) {
      if (monthOf(session.date) !== month) {
        month = monthOf(session.date);
        rows.push({ kind: 'month', month });
      }
      rows.push({
        kind: 'session',
        date: session.date,
        workout: session.workout,
        sets: session.sets,
        volume,
        change,
        isPR,
      });
    }
    sections.push({ exercise, rows });
  }
  return sections;
}
