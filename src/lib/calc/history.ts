/**
 * Comparing sessions of one exercise over time: last time, change vs last
 * time, volume PRs. Pure and dependency-free.
 *
 * A "session" is one entry: one exercise within one workout. Only finished
 * workouts count; drafts are ignored everywhere here. Dates are
 * "YYYY-MM-DD" strings, which sort correctly as text.
 */
import type { SetSlot } from '../model/sets';
import { doneVolume } from './volume';

export interface Session {
  /** The workout's date. */
  date: string;
  status: 'draft' | 'finished';
  /** The exercise's id. */
  exercise: string;
  sets: readonly SetSlot[];
}

export interface Change {
  /** This volume minus last time's. */
  amount: number;
  /** The same as a percentage of last time's, or null when last time was 0. */
  percent: number | null;
}

export interface HistoryRow<S extends Session = Session> {
  session: S;
  volume: number;
  /** Change vs the previous finished session; null for the first session. */
  change: Change | null;
  /** Higher than every earlier session, and above 0. Ties aren't PRs. */
  isPR: boolean;
}

/** The finished sessions of one exercise, oldest first. */
export function finishedSessions<S extends Session>(sessions: readonly S[], exercise: string): S[] {
  return sessions
    .filter((s) => s.status === 'finished' && s.exercise === exercise)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * "Last time" for an exercise on a date: the most recent finished session
 * of it strictly before that date (the prefill source), or null.
 */
export function lastTime<S extends Session>(sessions: readonly S[], exercise: string, date: string): S | null {
  let best: S | null = null;
  for (const s of sessions) {
    if (s.status !== 'finished' || s.exercise !== exercise || s.date >= date) continue;
    if (!best || s.date > best.date) best = s;
  }
  return best;
}

/** Change from `previous` volume to `current`; null when there's no previous session. */
export function changeVs(current: number, previous: number | null): Change | null {
  if (previous === null) return null;
  // Exact to the hundredth, like the volumes themselves.
  const amount = Math.round((current - previous) * 100) / 100;
  return { amount, percent: previous === 0 ? null : (amount / previous) * 100 };
}

/** Whether `volume` is a PR given every earlier session's volume. */
export function isVolumePR(volume: number, earlierVolumes: readonly number[]): boolean {
  return volume > 0 && earlierVolumes.every((v) => volume > v);
}

/**
 * The exercise's finished sessions, oldest first, each with its volume,
 * change vs the previous session, and whether it was a volume PR.
 */
export function exerciseHistory<S extends Session>(sessions: readonly S[], exercise: string): HistoryRow<S>[] {
  const rows: HistoryRow<S>[] = [];
  let best = 0; // highest volume so far (PRs need > 0 anyway)
  let previous: number | null = null;
  for (const session of finishedSessions(sessions, exercise)) {
    const volume = doneVolume(session.sets);
    rows.push({ session, volume, change: changeVs(volume, previous), isPR: volume > best });
    best = Math.max(best, volume);
    previous = volume;
  }
  return rows;
}
