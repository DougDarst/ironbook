/**
 * The logbook as CSV, in the sheet's format (spec › CSV import and export):
 * one row per entry: Exercise, Date (M/D/YY), W1, R1 … W20, R20, Volume.
 * Export writes done sets only, in their set positions (a set that wasn't
 * done is left blank). The reader is the first half of import (Story 21):
 * it turns a file into rows and per-row errors, without touching the
 * server. Pure and dependency-free; unit-tested in logbook-csv.test.ts.
 */
import { doneVolume, finishedSessions, type Session } from '../calc';
import { formatWeight } from '../format';
import { sheetDate } from '../history';
import { isValidDate } from '../model/dates';
import { MAX_EXERCISE_NAME, normalizeExerciseName } from '../model/exercises';
import { MAX_REPS, MAX_WEIGHT, SETS_PER_ENTRY, emptySets, type SetSlot } from '../model/sets';
import { detectSeparator, parseCsv, toCsv } from './csv';

const SLOTS = Array.from({ length: SETS_PER_ENTRY }, (_, i) => i + 1);
export const CSV_HEADER: readonly string[] = ['Exercise', 'Date', ...SLOTS.flatMap((n) => [`W${n}`, `R${n}`]), 'Volume'];

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/**
 * Every finished session as CSV, sorted by exercise (ignoring case), then
 * date. Done sets only; Volume is the done volume (exact, no separators).
 */
export function exportCsv(sessions: readonly Session[], exercises: readonly { id: string; name: string }[]): string {
  const rows: string[][] = [];
  for (const exercise of [...exercises].sort((a, b) => byName(a.name, b.name))) {
    for (const session of finishedSessions(sessions, exercise.id)) {
      const cells = session.sets.flatMap((s) =>
        s.done && s.weight !== null && s.reps !== null ? [formatWeight(s.weight), String(s.reps)] : ['', ''],
      );
      rows.push([exercise.name, sheetDate(session.date), ...cells, formatWeight(doneVolume(session.sets))]);
    }
  }
  return toCsv([CSV_HEADER, ...rows]);
}

/** One entry read from a file: every set in it is done. */
export interface CsvEntry {
  /** The file's row number (counting from 1, header included). */
  row: number;
  exercise: string;
  date: string;
  sets: SetSlot[];
}

export interface CsvProblem {
  row: number;
  message: string;
}

export interface CsvRead {
  entries: CsvEntry[];
  problems: CsvProblem[];
}

/** Where each value is: column indexes for the exercise, the date and each set's weight and reps. */
interface Layout {
  exercise: number;
  date: number;
  weights: (number | null)[];
  reps: (number | null)[];
}

const blank = (cell: string | undefined) => (cell ?? '').trim() === '';

/** The columns named by a header row: Exercise, Date, W1…W20, R1…R20 (any case); others ignored. */
function headerLayout(header: readonly string[]): Layout | null {
  const names = header.map((h) => h.trim().toLowerCase());
  const exercise = names.indexOf('exercise');
  const date = names.indexOf('date');
  if (exercise < 0 || date < 0) return null;
  const find = (prefix: string, n: number) => {
    const i = names.indexOf(`${prefix}${n}`);
    return i < 0 ? null : i;
  };
  return { exercise, date, weights: SLOTS.map((n) => find('w', n)), reps: SLOTS.map((n) => find('r', n)) };
}

/**
 * Without a header: columns blank in every row are dropped (the sheet has
 * empty ones), then Exercise, Date, W1, R1 … in order; an odd column left
 * over at the end is Volume.
 */
function positionalLayout(rows: readonly (readonly string[])[]): Layout {
  const width = Math.max(...rows.map((r) => r.length));
  const used = Array.from({ length: width }, (_, c) => c).filter((c) => rows.some((r) => !blank(r[c])));
  const [exercise = 0, date = 1, ...rest] = used;
  const pairs = Math.min(SETS_PER_ENTRY, Math.floor(rest.length / 2));
  return {
    exercise,
    date,
    weights: SLOTS.map((n) => (n <= pairs ? rest[(n - 1) * 2]! : null)),
    reps: SLOTS.map((n) => (n <= pairs ? rest[(n - 1) * 2 + 1]! : null)),
  };
}

/** "11/10/26", "11/10/2026" or "2026-11-10" → "2026-11-10"; two-digit years are 20YY. Null if not a real date. */
export function readDate(text: string): string | null {
  const t = text.trim();
  if (isValidDate(t)) return t;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(t);
  if (!m) return null;
  const year = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
  const date = `${year}-${m[1]!.padStart(2, '0')}-${m[2]!.padStart(2, '0')}`;
  return isValidDate(date) ? date : null;
}

/** A number cell ("1,250" and " 45 " are fine); null when blank, NaN when not a number. */
function readNumber(text: string | undefined): number | null {
  const t = (text ?? '').trim().replaceAll(',', '').replaceAll(' ', '');
  if (t === '') return null;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

/**
 * Reads a CSV file into entries and problems (each with its row number).
 * Comma- or tab-separated (rows copied from a spreadsheet are tab-separated).
 * Tolerant of a header row, blank columns, blank rows and thousands
 * separators. Every set read is done. A row is refused for a missing or
 * too-long exercise name, a date that isn't a real date or is after
 * `today`, a weight without reps (or the other way round), numbers out of
 * range, or the same exercise and date as an earlier row.
 */
export function readCsv(text: string, today: string): CsvRead {
  const body = text.startsWith('\uFEFF') ? text.slice(1) : text;
  const all = parseCsv(body, detectSeparator(body)).map((cells, i) => ({ row: i + 1, cells }));
  const rows = all.filter((r) => r.cells.some((c) => !blank(c)));
  const header = rows[0] ? headerLayout(rows[0].cells) : null;
  const data = header ? rows.slice(1) : rows;
  const layout = header ?? positionalLayout(data.map((r) => r.cells));

  const entries: CsvEntry[] = [];
  const problems: CsvProblem[] = [];
  const seen = new Map<string, number>();
  for (const { row, cells } of data) {
    const fail = (message: string) => problems.push({ row, message });
    const exercise = normalizeExerciseName(cells[layout.exercise] ?? '');
    if (!exercise) {
      fail('The exercise name is missing.');
      continue;
    }
    if (exercise.length > MAX_EXERCISE_NAME) {
      fail(`The exercise name is longer than ${MAX_EXERCISE_NAME} characters.`);
      continue;
    }
    const dateText = (cells[layout.date] ?? '').trim();
    const date = readDate(dateText);
    if (!date) {
      fail(dateText ? `"${dateText}" isn't a date (use M/D/YY, e.g. 11/10/26).` : 'The date is missing.');
      continue;
    }
    if (date > today) {
      fail(`${sheetDate(date)} is in the future.`);
      continue;
    }

    const sets = emptySets();
    let problem: string | null = null;
    for (const [i, n] of SLOTS.entries()) {
      const w = layout.weights[i];
      const r = layout.reps[i];
      const weight = w === null || w === undefined ? null : readNumber(cells[w]);
      const reps = r === null || r === undefined ? null : readNumber(cells[r]);
      if (weight === null && reps === null) continue;
      if (weight === null || reps === null) problem = `Set ${n} needs both weight and reps.`;
      else if (Number.isNaN(weight) || weight > MAX_WEIGHT || Math.abs(weight * 100 - Math.round(weight * 100)) > 1e-6) {
        problem = `Set ${n}: the weight must be a number from 0 to ${MAX_WEIGHT}, with at most 2 decimals.`;
      } else if (Number.isNaN(reps) || !Number.isInteger(reps) || reps > MAX_REPS) {
        problem = `Set ${n}: reps must be a whole number from 0 to ${MAX_REPS}.`;
      } else {
        sets[i] = { weight, reps, done: true };
        continue;
      }
      break;
    }
    if (problem) {
      fail(problem);
      continue;
    }

    const key = `${exercise.toLowerCase()}|${date}`;
    const earlier = seen.get(key);
    if (earlier !== undefined) {
      fail(`Same exercise and date as row ${earlier}.`);
      continue;
    }
    seen.set(key, row);
    entries.push({ row, exercise, date, sets });
  }
  return { entries, problems };
}
