/**
 * Compares two logbook CSV files entry by entry: the Google Sheet the
 * history was imported from, and an export from the app after the import
 * (Story 22). Both are read with the importer's own reader, so a row the
 * importer refused shows up as a problem in the sheet, not a silent gap.
 * Entries match by exercise (ignoring case) and date; sets compare by
 * position (weight and reps), and volume is recalculated on both sides.
 * Pure and dependency-free; unit-tested in compare.test.ts.
 */
import { doneVolume } from '../calc';
import { formatVolume } from '../format';
import { sheetDate } from '../history';
import type { CsvEntry, CsvProblem, CsvRead } from './logbook-csv';

/** One entry as compared: where it is and its volume. */
export interface ComparedEntry {
  exercise: string;
  date: string;
  /** Row number in its file. */
  row: number;
  volume: number;
}

/** An entry in both files whose sets differ. */
export interface EntryDifference {
  exercise: string;
  date: string;
  sheet: ComparedEntry;
  live: ComparedEntry;
}

/** Totals for one exercise in each file. */
export interface ExerciseTotals {
  exercise: string;
  sheetEntries: number;
  liveEntries: number;
  sheetVolume: number;
  liveVolume: number;
}

export interface Comparison {
  /** Rows of the sheet the importer can't read (so they were never imported). */
  sheetProblems: CsvProblem[];
  /** Rows of the export that can't be read back (should never happen). */
  liveProblems: CsvProblem[];
  onlyInSheet: ComparedEntry[];
  onlyInLive: ComparedEntry[];
  different: EntryDifference[];
  /** Per exercise, sorted by name (ignoring case). */
  exercises: ExerciseTotals[];
  matched: number;
}

const keyOf = (e: CsvEntry) => `${e.exercise.toLowerCase()}|${e.date}`;
const compared = (e: CsvEntry): ComparedEntry => ({ exercise: e.exercise, date: e.date, row: e.row, volume: doneVolume(e.sets) });
const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
const byEntry = (a: ComparedEntry, b: ComparedEntry) => byName(a.exercise, b.exercise) || a.date.localeCompare(b.date);

/** True when both entries have the same weight and reps in every set position. */
function sameSets(a: CsvEntry, b: CsvEntry): boolean {
  return a.sets.every((s, i) => {
    const t = b.sets[i];
    return t !== undefined && s.weight === t.weight && s.reps === t.reps;
  });
}

/** Compares the sheet (what was imported) with the live export (what the app holds). */
export function compareLogbooks(sheet: CsvRead, live: CsvRead): Comparison {
  const liveByKey = new Map(live.entries.map((e) => [keyOf(e), e]));
  const totals = new Map<string, ExerciseTotals>();
  const totalsFor = (exercise: string) => {
    const k = exercise.toLowerCase();
    let t = totals.get(k);
    if (!t) {
      t = { exercise, sheetEntries: 0, liveEntries: 0, sheetVolume: 0, liveVolume: 0 };
      totals.set(k, t);
    }
    return t;
  };

  const result: Comparison = {
    sheetProblems: sheet.problems,
    liveProblems: live.problems,
    onlyInSheet: [],
    onlyInLive: [],
    different: [],
    exercises: [],
    matched: 0,
  };

  // Volumes are summed in hundredths so the totals stay exact.
  const add = (volume: number) => Math.round(volume * 100);
  for (const s of sheet.entries) {
    const t = totalsFor(s.exercise);
    t.sheetEntries += 1;
    t.sheetVolume += add(doneVolume(s.sets));
    const l = liveByKey.get(keyOf(s));
    if (!l) result.onlyInSheet.push(compared(s));
    else if (!sameSets(s, l)) result.different.push({ exercise: s.exercise, date: s.date, sheet: compared(s), live: compared(l) });
    else result.matched += 1;
  }
  const sheetKeys = new Set(sheet.entries.map(keyOf));
  for (const l of live.entries) {
    const t = totalsFor(l.exercise);
    t.liveEntries += 1;
    t.liveVolume += add(doneVolume(l.sets));
    if (!sheetKeys.has(keyOf(l))) result.onlyInLive.push(compared(l));
  }

  result.exercises = [...totals.values()]
    .map((t) => ({ ...t, sheetVolume: t.sheetVolume / 100, liveVolume: t.liveVolume / 100 }))
    .sort((a, b) => byName(a.exercise, b.exercise));
  result.onlyInSheet.sort(byEntry);
  result.onlyInLive.sort(byEntry);
  result.different.sort((a, b) => byEntry(a.sheet, b.sheet));
  return result;
}

/** True when every entry the sheet holds is on the live site, identical, and nothing else is. */
export function logbooksMatch(c: Comparison): boolean {
  return (
    c.sheetProblems.length === 0 &&
    c.liveProblems.length === 0 &&
    c.onlyInSheet.length === 0 &&
    c.onlyInLive.length === 0 &&
    c.different.length === 0
  );
}

const pad = (text: string, width: number) => text.padEnd(width);
const entries = (n: number) => (n === 1 ? '1 entry is' : `${n} entries are`);
const entryLine = (e: ComparedEntry) => `  ${e.exercise} ${sheetDate(e.date)} (row ${e.row}): volume ${formatVolume(e.volume)}`;

/** The comparison as plain text for the terminal. */
export function formatComparison(c: Comparison): string {
  const lines: string[] = [];
  const nameWidth = Math.max('Exercise'.length, ...c.exercises.map((t) => t.exercise.length)) + 2;
  lines.push(`${pad('Exercise', nameWidth)}${pad('Entries (sheet / live)', 26)}Volume (sheet / live)`);
  for (const t of c.exercises) {
    const ok = t.sheetEntries === t.liveEntries && t.sheetVolume === t.liveVolume;
    lines.push(
      `${pad(t.exercise, nameWidth)}${pad(`${t.sheetEntries} / ${t.liveEntries}`, 26)}` +
        `${formatVolume(t.sheetVolume)} / ${formatVolume(t.liveVolume)}  ${ok ? 'ok' : 'DIFFERENT'}`,
    );
  }

  const section = (title: string, items: string[]) => {
    if (items.length === 0) return;
    lines.push('', `${title} (${items.length}):`, ...items);
  };
  section(
    "Sheet rows the importer can't read",
    c.sheetProblems.map((p) => `  row ${p.row}: ${p.message}`),
  );
  section(
    "Export rows that can't be read back",
    c.liveProblems.map((p) => `  row ${p.row}: ${p.message}`),
  );
  section('Only in the sheet', c.onlyInSheet.map(entryLine));
  section('Only on the live site', c.onlyInLive.map(entryLine));
  section(
    'Different sets',
    c.different.map(
      (d) =>
        `  ${d.exercise} ${sheetDate(d.date)} (sheet row ${d.sheet.row}, export row ${d.live.row}): ` +
        `volume ${formatVolume(d.sheet.volume)} / ${formatVolume(d.live.volume)}`,
    ),
  );

  lines.push('');
  if (logbooksMatch(c)) lines.push(`MATCH: ${c.matched === 1 ? 'the 1 entry is' : `all ${c.matched} entries are`} identical.`);
  else {
    const issues =
      c.sheetProblems.length + c.liveProblems.length + c.onlyInSheet.length + c.onlyInLive.length + c.different.length;
    lines.push(`DIFFERENCES: ${issues} found; ${entries(c.matched)} identical.`);
  }
  return lines.join('\n');
}
