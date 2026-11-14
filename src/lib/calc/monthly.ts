/**
 * Monthly total volume for one exercise. Pure and dependency-free.
 */
import { monthOf, nextMonth } from '../model/dates';
import type { Session } from './history';
import { doneVolume } from './volume';

export interface MonthTotal {
  /** "YYYY-MM". */
  month: string;
  volume: number;
  /** The current (incomplete) month. */
  current: boolean;
}

/**
 * Total done volume per calendar month for an exercise's finished
 * sessions, for every month from its first session through the month of
 * `today` (months without sessions are 0). Empty if it has no finished
 * sessions.
 */
export function monthlyTotals(sessions: readonly Session[], exercise: string, today: string): MonthTotal[] {
  const totals = new Map<string, number>(); // in hundredths, exact
  let first: string | null = null;
  for (const s of sessions) {
    if (s.status !== 'finished' || s.exercise !== exercise) continue;
    const month = monthOf(s.date);
    totals.set(month, (totals.get(month) ?? 0) + Math.round(doneVolume(s.sets) * 100));
    if (first === null || month < first) first = month;
  }
  if (first === null) return [];

  const thisMonth = monthOf(today);
  const last = [...totals.keys()].reduce((a, b) => (b > a ? b : a), thisMonth);
  const months: MonthTotal[] = [];
  for (let month = first; month <= last; month = nextMonth(month)) {
    months.push({ month, volume: (totals.get(month) ?? 0) / 100, current: month === thisMonth });
  }
  return months;
}
