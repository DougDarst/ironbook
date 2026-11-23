import { describe, expect, it } from 'vitest';
import type { Session } from '../calc';
import sample from './fixtures/sheet-sample.tsv?raw';
import { compareLogbooks, exportCsv, formatComparison, logbooksMatch, readCsv, type CsvEntry } from '.';

const TODAY = '2026-11-22';
const read = (text: string) => readCsv(text, TODAY);
const csv = (...rows: string[][]) => rows.map((r) => r.join(',')).join('\n');
const HEADER = ['Exercise', 'Date', 'W1', 'R1', 'W2', 'R2', 'W3', 'R3'];

/** What the app would export after importing these entries (each exercise's id is its lower-case name). */
function exportOf(entries: readonly CsvEntry[]): string {
  const names = new Map(entries.map((e) => [e.exercise.toLowerCase(), e.exercise]));
  const sessions: Session[] = entries.map((e) => ({ exercise: e.exercise.toLowerCase(), date: e.date, status: 'finished', sets: e.sets }));
  return exportCsv(sessions, [...names].map(([id, name]) => ({ id, name })));
}

describe('compareLogbooks', () => {
  it('matches the sheet sample against its own export (the Story 22 check, end to end)', () => {
    const sheet = read(sample);
    expect(sheet.entries).toHaveLength(4);
    const c = compareLogbooks(sheet, read(exportOf(sheet.entries)));
    expect(logbooksMatch(c)).toBe(true);
    expect(c.matched).toBe(sheet.entries.length);
    for (const t of c.exercises) {
      expect(t.liveEntries).toBe(t.sheetEntries);
      expect(t.liveVolume).toBe(t.sheetVolume);
    }
    expect(formatComparison(c)).toContain(`MATCH: all ${sheet.entries.length} entries are identical.`);
  });

  it('matches exercises ignoring case and dates written differently', () => {
    const c = compareLogbooks(
      read(csv(HEADER, ['bench press', '9/1/26', '135', '5'])),
      read(csv(HEADER, ['Bench Press', '2026-09-01', '135', '5'])),
    );
    expect(logbooksMatch(c)).toBe(true);
    expect(c.exercises).toHaveLength(1);
  });

  it('finds an entry missing on the live site and one only on the live site', () => {
    const c = compareLogbooks(
      read(csv(HEADER, ['Squat', '10/1/26', '225', '5'], ['Squat', '10/3/26', '235', '5'])),
      read(csv(HEADER, ['Squat', '10/1/26', '225', '5'], ['Squat', '10/4/26', '235', '5'])),
    );
    expect(logbooksMatch(c)).toBe(false);
    expect(c.onlyInSheet.map((e) => [e.date, e.row, e.volume])).toEqual([['2026-10-03', 3, 1175]]);
    expect(c.onlyInLive.map((e) => [e.date, e.row, e.volume])).toEqual([['2026-10-04', 3, 1175]]);
    expect(c.matched).toBe(1);
  });

  it('finds different sets even when the volume is the same', () => {
    // 100 × 10 and 200 × 5 are both 1,000: a volume-only check would miss it.
    const c = compareLogbooks(read(csv(HEADER, ['Row', '10/1/26', '100', '10'])), read(csv(HEADER, ['Row', '10/1/26', '200', '5'])));
    expect(c.different).toHaveLength(1);
    expect(c.different[0]!.sheet.volume).toBe(c.different[0]!.live.volume);
    expect(c.exercises[0]).toMatchObject({ sheetVolume: 1000, liveVolume: 1000 });
    expect(logbooksMatch(c)).toBe(false);
  });

  it('finds the same set in a different position', () => {
    const c = compareLogbooks(
      read(csv(HEADER, ['Row', '10/1/26', '100', '10', '', ''])),
      read(csv(HEADER, ['Row', '10/1/26', '', '', '100', '10'])),
    );
    expect(c.different).toHaveLength(1);
  });

  it('counts a sheet row the importer refuses as a difference', () => {
    const c = compareLogbooks(
      read(csv(HEADER, ['Squat', '10/1/26', '225', '5'], ['Squat', '10/2/26', '225', ''])),
      read(csv(HEADER, ['Squat', '10/1/26', '225', '5'])),
    );
    expect(c.sheetProblems).toEqual([{ row: 3, message: 'Set 1 needs both weight and reps.' }]);
    expect(c.onlyInSheet).toEqual([]);
    expect(logbooksMatch(c)).toBe(false);
  });

  it('totals volumes per exercise exactly, sorted by name ignoring case', () => {
    const c = compareLogbooks(
      read(csv(HEADER, ['squat', '10/1/26', '0.1', '3'], ['squat', '10/2/26', '0.2', '3'], ['Bench', '10/1/26', '2.5', '1'])),
      read(csv(HEADER, ['squat', '10/1/26', '0.1', '3'])),
    );
    expect(c.exercises).toEqual([
      { exercise: 'Bench', sheetEntries: 1, liveEntries: 0, sheetVolume: 2.5, liveVolume: 0 },
      { exercise: 'squat', sheetEntries: 2, liveEntries: 1, sheetVolume: 0.9, liveVolume: 0.3 },
    ]);
  });

  it('sorts the lists by exercise, then date', () => {
    const c = compareLogbooks(
      read(csv(HEADER, ['Squat', '10/2/26', '1', '1'], ['bench', '10/9/26', '1', '1'], ['Squat', '10/1/26', '1', '1'])),
      read(csv(HEADER)),
    );
    expect(c.onlyInSheet.map((e) => `${e.exercise} ${e.date}`)).toEqual(['bench 2026-10-09', 'Squat 2026-10-01', 'Squat 2026-10-02']);
  });
});

describe('formatComparison', () => {
  it('lists every kind of difference with rows and volumes, and the count', () => {
    const c = compareLogbooks(
      read(csv(HEADER, ['Squat', '10/1/26', '225', '5'], ['Squat', '10/2/26', '100', '10'], ['Squat', '10/3/26', 'x', '5'])),
      read(csv(HEADER, ['Squat', '10/2/26', '200', '5'], ['Curl', '10/5/26', '30', '10'], ['Curl', 'soon', '30', '10'])),
    );
    const text = formatComparison(c);
    expect(text).toContain("Sheet rows the importer can't read (1):\n  row 4: Set 1: the weight must be a number");
    expect(text).toContain('Export rows that can\'t be read back (1):\n  row 4: "soon" isn\'t a date');
    expect(text).toContain('Only in the sheet (1):\n  Squat 10/1/26 (row 2): volume 1,125');
    expect(text).toContain('Only on the live site (1):\n  Curl 10/5/26 (row 3): volume 300');
    expect(text).toContain('Different sets (1):\n  Squat 10/2/26 (sheet row 3, export row 2): volume 1,000 / 1,000');
    expect(text).toMatch(/^Curl +0 \/ 1 +0 \/ 300 {2}DIFFERENT$/m);
    expect(text).toMatch(/^Squat +2 \/ 1 +2,125 \/ 1,000 {2}DIFFERENT$/m);
    expect(text.endsWith('DIFFERENCES: 5 found; 0 entries are identical.')).toBe(true);
  });

  it('marks matching exercises ok and leaves out empty sections', () => {
    const file = csv(HEADER, ['Squat', '10/1/26', '225', '5']);
    const text = formatComparison(compareLogbooks(read(file), read(file)));
    expect(text).toMatch(/^Squat +1 \/ 1 +1,125 \/ 1,125 {2}ok$/m);
    expect(text).not.toContain('Only in');
    expect(text).not.toContain('Different');
    expect(text.endsWith('MATCH: the 1 entry is identical.')).toBe(true);
  });

  it('says "1 entry is" when one entry matches among differences', () => {
    const c = compareLogbooks(read(csv(HEADER, ['Squat', '10/1/26', '225', '5'])), read(csv(HEADER, ['Squat', '10/1/26', '225', '5'], ['Row', '10/1/26', '1', '1'])));
    expect(formatComparison(c).endsWith('DIFFERENCES: 1 found; 1 entry is identical.')).toBe(true);
  });
});
