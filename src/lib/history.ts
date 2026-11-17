/**
 * The History screen's content: one section per exercise, its finished
 * sessions oldest first, with month dividers. Pure functions, unit-tested in
 * history.test.ts. Volume, change and PRs come from the calc module.
 */
import { exerciseHistory, type Change, type Session } from './calc';
import { formatWeight } from './format';
import { monthOf } from './model/dates';

export interface HistorySession extends Session {
  /** The workout's id, to open it for editing. */
  workout: string;
}

export interface HistoryRow {
  kind: 'session';
  date: string;
  workout: string;
  /** One cell per set slot: "lbs×reps" for a done set, null otherwise (positions kept). */
  cells: (string | null)[];
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

/** Sets per row on the iPhone cards. */
export const CARD_ROW = 5;

/**
 * The set cells an iPhone card shows: whole rows of CARD_ROW, up to the last
 * row holding a done set (positions kept, so a not-done set inside stays a
 * blank slot). Empty when no set was done.
 */
export function cardCells(cells: readonly (string | null)[]): (string | null)[] {
  let last = cells.length - 1;
  while (last >= 0 && cells[last] === null) last -= 1;
  if (last < 0) return [];
  return cells.slice(0, Math.ceil((last + 1) / CARD_ROW) * CARD_ROW);
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
        cells: session.sets.map((s) =>
          s.done && s.weight !== null && s.reps !== null ? `${formatWeight(s.weight)}×${s.reps}` : null,
        ),
        volume,
        change,
        isPR,
      });
    }
    sections.push({ exercise, rows });
  }
  return sections;
}
