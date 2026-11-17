import { describe, expect, it } from 'vitest';
import type { Session } from '../calc';
import { emptySets, type SetSlot } from '../model/sets';
import { CSV_HEADER, exportCsv, parseCsv, readCsv, readDate, toCsv } from '.';

describe('toCsv / parseCsv', () => {
  it('quotes only fields that need it, doubling quotes', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"', ' pad', 'line\nbreak']])).toBe('a,"b,c","say ""hi"""," pad","line\nbreak"\r\n');
  });

  it('reads back exactly what it writes', () => {
    const rows = [
      ['Exercise', 'Date'],
      ['Curl, "EZ" bar', '1/2/26'],
      ['', 'multi\r\nline'],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it('accepts LF, CR, a byte order mark, and no final line break', () => {
    expect(parseCsv('﻿a,b\nc,d\re,f')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
    ]);
    expect(parseCsv('a,,\n')).toEqual([['a', '', '']]);
    expect(parseCsv('')).toEqual([]);
  });
});

// Sessions as the app stores them.
function sets(...filled: (Partial<SetSlot> | null)[]): SetSlot[] {
  return emptySets().map((slot, i) => ({ ...slot, ...(filled[i] ?? {}) }));
}
const done = (weight: number, reps: number) => ({ weight, reps, done: true });
const session = (exercise: string, date: string, s: SetSlot[], status: Session['status'] = 'finished'): Session => ({
  exercise,
  date,
  status,
  sets: s,
});
const exercises = [
  { id: 'squat', name: 'Squat' },
  { id: 'bench', name: 'bench press' },
  { id: 'curl', name: 'Curl, "EZ" bar' },
];

describe('exportCsv', () => {
  const data = [
    session('squat', '2026-10-02', sets(done(225, 5))),
    session('bench', '2026-11-10', sets(done(135, 10), { weight: 145, reps: 8, done: false }, done(155, 6))),
    session('bench', '2026-09-01', sets(done(2.5, 12))),
    session('bench', '2026-11-12', sets(done(999, 9)), 'draft'),
    session('curl', '2026-11-01', sets({ weight: 30, reps: 10, done: false })),
  ];
  const rows = parseCsv(exportCsv(data, exercises));

  it('starts with the header: Exercise, Date, W1, R1 … W20, R20, Volume', () => {
    expect(rows[0]).toEqual(CSV_HEADER);
    expect(CSV_HEADER).toHaveLength(43);
    expect(CSV_HEADER.slice(0, 4)).toEqual(['Exercise', 'Date', 'W1', 'R1']);
    expect(CSV_HEADER.slice(-3)).toEqual(['W20', 'R20', 'Volume']);
  });

  it('has finished sessions only, by exercise (ignoring case) then date', () => {
    expect(rows.slice(1).map((r) => [r[0], r[1]])).toEqual([
      ['bench press', '9/1/26'],
      ['bench press', '11/10/26'],
      ['Curl, "EZ" bar', '11/1/26'],
      ['Squat', '10/2/26'],
    ]);
  });

  it('writes done sets in their positions, blank where a set was not done, and the done volume', () => {
    const bench = rows[2]!;
    expect(bench.slice(2, 8)).toEqual(['135', '10', '', '', '155', '6']);
    expect(bench.slice(8, 42).every((c) => c === '')).toBe(true);
    expect(bench[42]).toBe('2280'); // 1350 + 930, no separators
    expect(rows[1]!.slice(2, 4)).toEqual(['2.5', '12']);
    expect(rows[1]![42]).toBe('30');
  });

  it('keeps a finished session with no done sets, with volume 0', () => {
    expect(rows[3]!.slice(2, 42).every((c) => c === '')).toBe(true);
    expect(rows[3]![42]).toBe('0');
  });
});

describe('readDate', () => {
  it('reads M/D/YY (20YY), M/D/YYYY and YYYY-MM-DD', () => {
    expect(readDate('11/10/26')).toBe('2026-11-10');
    expect(readDate('1/5/09')).toBe('2009-01-05');
    expect(readDate(' 1/5/2009 ')).toBe('2009-01-05');
    expect(readDate('2026-02-28')).toBe('2026-02-28');
  });

  it('refuses dates that do not exist or are not dates', () => {
    for (const bad of ['2/30/26', '13/1/26', '11-10-26', '11/10', 'yesterday', '']) expect(readDate(bad), bad).toBeNull();
  });
});

describe('readCsv', () => {
  const TODAY = '2026-11-16';
  const line = (...cells: string[]) => cells.join(',');

  it('reads the export back: identical exercises, dates and done sets (the round trip)', () => {
    const data = [
      session('squat', '2026-10-02', sets(done(225, 5), done(0, 12))),
      session('bench', '2026-11-10', sets(done(135, 10), { weight: 145, reps: 8, done: false }, done(155.25, 6))),
      session('curl', '2026-11-01', sets(...Array.from({ length: 20 }, (_, i) => done(30 + i, 10)))),
      session('bench', '2026-09-01', sets()),
    ];
    const { entries, problems } = readCsv(exportCsv(data, exercises), TODAY);
    expect(problems).toEqual([]);
    const name = (id: string) => exercises.find((e) => e.id === id)!.name;
    // What should come back: each finished session's done sets, in place.
    const expected = data
      .map((s) => ({
        exercise: name(s.exercise),
        date: s.date,
        sets: s.sets.map((slot) => (slot.done ? slot : { weight: null, reps: null, done: false })),
      }))
      .sort((a, b) => a.exercise.localeCompare(b.exercise, undefined, { sensitivity: 'base' }) || a.date.localeCompare(b.date));
    expect(entries.map(({ exercise, date, sets }) => ({ exercise, date, sets }))).toEqual(expected);
  });

  it('reads a sheet-like file: no header, blank columns, blank rows, separators, no volume', () => {
    const text = [
      line('Bench Press', '', '11/10/26', '', '135', '10', '"1,005"', '1', '', ''),
      '',
      line(' squat ', '', '9/1/26', '', '225', '5', '', '', '', ''),
      ',,,,,,,,,',
    ].join('\n');
    const { entries, problems } = readCsv(text, TODAY);
    expect(problems).toEqual([]);
    expect(entries.map((e) => [e.row, e.exercise, e.date, e.sets.slice(0, 2)])).toEqual([
      [1, 'Bench Press', '2026-11-10', [done(135, 10), done(1005, 1)]],
      [3, 'squat', '2026-09-01', [done(225, 5), { weight: null, reps: null, done: false }]],
    ]);
  });

  it('takes an odd last column as Volume and ignores it', () => {
    const { entries } = readCsv(line('Squat', '9/1/26', '225', '5', '99999'), TODAY);
    expect(entries[0]!.sets.slice(0, 2)).toEqual([done(225, 5), { weight: null, reps: null, done: false }]);
  });

  it('maps columns by a header row, in any order and case, ignoring others', () => {
    const text = [line('date', 'notes', 'R1', 'W1', 'EXERCISE', 'w2', 'r2', 'volume'), line('11/10/26', 'felt good', '10', '135', 'Bench', '145', '8', '1')].join(
      '\n',
    );
    const { entries, problems } = readCsv(text, TODAY);
    expect(problems).toEqual([]);
    expect(entries[0]).toMatchObject({ row: 2, exercise: 'Bench', date: '2026-11-10' });
    expect(entries[0]!.sets.slice(0, 2)).toEqual([done(135, 10), done(145, 8)]);
  });

  it('reports each problem with its row number, keeping the good rows', () => {
    const text = [
      line('Exercise', 'Date', 'W1', 'R1'),
      line('', '11/10/26', '100', '5'),
      line('Bench', '2/30/26', '100', '5'),
      line('Bench', '', '100', '5'),
      line('Bench', '12/1/26', '100', '5'),
      line('Bench', '11/1/26', '100', ''),
      line('Bench', '11/2/26', 'lots', '5'),
      line('Bench', '11/3/26', '2001', '5'),
      line('Bench', '11/4/26', '100.555', '5'),
      line('Bench', '11/5/26', '100', '5.5'),
      line('Bench', '11/6/26', '100', '1000'),
      line('Bench', '11/7/26', '100', '5'),
      line('BENCH', '11/7/26', '110', '5'),
      line('x'.repeat(101), '11/8/26', '100', '5'),
    ].join('\n');
    const { entries, problems } = readCsv(text, TODAY);
    expect(entries.map((e) => e.row)).toEqual([12]);
    expect(problems).toEqual([
      { row: 2, message: 'The exercise name is missing.' },
      { row: 3, message: `"2/30/26" isn't a date (use M/D/YY, e.g. 11/10/26).` },
      { row: 4, message: 'The date is missing.' },
      { row: 5, message: '12/1/26 is in the future.' },
      { row: 6, message: 'Set 1 needs both weight and reps.' },
      { row: 7, message: 'Set 1: the weight must be a number from 0 to 2000, with at most 2 decimals.' },
      { row: 8, message: 'Set 1: the weight must be a number from 0 to 2000, with at most 2 decimals.' },
      { row: 9, message: 'Set 1: the weight must be a number from 0 to 2000, with at most 2 decimals.' },
      { row: 10, message: 'Set 1: reps must be a whole number from 0 to 999.' },
      { row: 11, message: 'Set 1: reps must be a whole number from 0 to 999.' },
      { row: 13, message: 'Same exercise and date as row 12.' },
      { row: 14, message: 'The exercise name is longer than 100 characters.' },
    ]);
  });

  it('accepts 2-decimal weights that floating point cannot store exactly', () => {
    const { entries, problems } = readCsv(line('Curl', '11/1/26', '2.55', '10'), TODAY);
    expect(problems).toEqual([]);
    expect(entries[0]!.sets[0]).toEqual(done(2.55, 10));
  });

  it('is empty for an empty file', () => {
    expect(readCsv('', TODAY)).toEqual({ entries: [], problems: [] });
    expect(readCsv('\n\n,,\n', TODAY)).toEqual({ entries: [], problems: [] });
  });
});
