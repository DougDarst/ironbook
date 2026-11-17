import { describe, expect, it } from 'vitest';
import type { HistoryRow, Session } from './calc';
import { defaultExercise, headlineDetail } from './metrics';
import { emptySets } from './model/sets';

const session = (exercise: string, date: string, status: Session['status'] = 'finished'): Session => ({
  exercise,
  date,
  status,
  sets: emptySets(),
});
const exercises = [
  { id: 'squat', name: 'Squat' },
  { id: 'bench', name: 'Bench Press' },
  { id: 'curl', name: 'curl' },
];

describe('defaultExercise', () => {
  it('is the exercise logged most recently', () => {
    expect(defaultExercise([session('squat', '2026-11-10'), session('bench', '2026-11-12'), session('squat', '2026-11-01')], exercises)).toBe(
      'bench',
    );
  });

  it('ignores drafts', () => {
    expect(defaultExercise([session('squat', '2026-11-10'), session('bench', '2026-11-16', 'draft')], exercises)).toBe('squat');
  });

  it('breaks a tie on the same day by name, ignoring case', () => {
    expect(defaultExercise([session('squat', '2026-11-10'), session('curl', '2026-11-10'), session('bench', '2026-11-10')], exercises)).toBe(
      'bench',
    );
    expect(defaultExercise([session('squat', '2026-11-10'), session('curl', '2026-11-10')], exercises)).toBe('curl');
  });

  it('is null without finished sessions', () => {
    expect(defaultExercise([], exercises)).toBeNull();
    expect(defaultExercise([session('squat', '2026-11-10', 'draft')], exercises)).toBeNull();
  });
});

describe('headlineDetail', () => {
  const row = (date: string, change: HistoryRow['change']): HistoryRow => ({
    session: session('bench', date),
    volume: 27_115,
    change,
    isPR: true,
  });

  it('gives the date and the change vs last time, in whole numbers', () => {
    expect(headlineDetail(row('2026-11-10', { amount: 1_110, percent: 4.27 }), '2026-11-16')).toBe(
      'Nov 10 · +1,110 (+4%) vs last time',
    );
    expect(headlineDetail(row('2026-11-10', { amount: -300, percent: -5.4 }), '2026-11-16')).toBe(
      'Nov 10 · −300 (−5%) vs last time',
    );
  });

  it('leaves out the percentage when last time was 0', () => {
    expect(headlineDetail(row('2026-11-10', { amount: 500, percent: null }), '2026-11-16')).toBe('Nov 10 · +500 vs last time');
  });

  it('says first session for the first one, with the year when it is not this year', () => {
    expect(headlineDetail(row('2025-12-30', null), '2026-11-16')).toBe('Dec 30, 2025 · first session');
  });
});
