/**
 * Every lift over a period, for History's "All exercises" view (redesign
 * Story 5): workouts, total volume, PRs, the most improved lift, and each
 * lift's sessions, volume and best session, against the previous period.
 * Pure and dependency-free; unit-tested in period.test.ts.
 */
import { addDays, daysInMonth } from '../model/dates';
import { exerciseHistory, type Session } from './history';

export type PeriodKind = 'month' | '90d';

/** Inclusive "YYYY-MM-DD" bounds. */
export interface Period {
  start: string;
  end: string;
}

/**
 * The period and the one it's compared with. "This month": the 1st to
 * today, against the same days of the month before (Nov 1–20 vs Oct 1–20,
 * shortened when that month is shorter). "Last 90 days": today and the 89
 * days before, against the 90 days before that.
 */
export function periodWindows(kind: PeriodKind, today: string): { current: Period; previous: Period } {
  if (kind === '90d') {
    const start = addDays(today, -89);
    return { current: { start, end: today }, previous: { start: addDays(start, -90), end: addDays(start, -1) } };
  }
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prefix = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  const lastDay = Math.min(Number(today.slice(8, 10)), daysInMonth(prevYear, prevMonth));
  return {
    current: { start: `${today.slice(0, 7)}-01`, end: today },
    previous: { start: `${prefix}-01`, end: `${prefix}-${String(lastDay).padStart(2, '0')}` },
  };
}

const within = (date: string, p: Period) => date >= p.start && date <= p.end;

export interface LiftPeriod {
  exercise: string;
  sessions: number;
  volume: number;
  /** The lift's volume in the previous period (0 if none). */
  previousVolume: number;
  /** The period's best session (the earliest on a tie), and whether it was a volume PR. */
  best: { date: string; volume: number; isPR: boolean };
}

export interface PeriodSummary {
  current: Period;
  previous: Period;
  /** Distinct workout days with a finished session. */
  workouts: number;
  previousWorkouts: number;
  volume: number;
  previousVolume: number;
  /** Volume PRs set in the period, oldest first. */
  prs: { exercise: string; date: string }[];
  /** The largest % gain from a lift's first to its latest session in the period (needs two sessions). */
  mostImproved: { exercise: string; percent: number; since: string } | null;
  /** Lifts with a session in the period. */
  lifts: LiftPeriod[];
}

/**
 * Sums up the finished sessions of `exercises` over a period. PRs are the
 * all-time volume PRs (beating every earlier session of the lift, not just
 * the period's).
 */
export function periodSummary(
  sessions: readonly Session[],
  exercises: readonly string[],
  kind: PeriodKind,
  today: string,
): PeriodSummary {
  const { current, previous } = periodWindows(kind, today);
  const days = new Set<string>();
  const previousDays = new Set<string>();
  const prs: PeriodSummary['prs'] = [];
  const lifts: LiftPeriod[] = [];
  let volume = 0;
  let previousVolume = 0;
  let mostImproved: PeriodSummary['mostImproved'] = null;

  for (const exercise of exercises) {
    const rows = exerciseHistory(sessions, exercise);
    const inPeriod = rows.filter((r) => within(r.session.date, current));
    const before = rows.filter((r) => within(r.session.date, previous));
    for (const r of before) previousDays.add(r.session.date);
    const liftPrevious = before.reduce((t, r) => t + r.volume, 0);
    previousVolume += liftPrevious;
    if (inPeriod.length === 0) continue;

    let best = inPeriod[0]!;
    let liftVolume = 0;
    for (const r of inPeriod) {
      days.add(r.session.date);
      liftVolume += r.volume;
      if (r.volume > best.volume) best = r;
      if (r.isPR) prs.push({ exercise, date: r.session.date });
    }
    volume += liftVolume;
    lifts.push({
      exercise,
      sessions: inPeriod.length,
      volume: liftVolume,
      previousVolume: liftPrevious,
      best: { date: best.session.date, volume: best.volume, isPR: best.isPR },
    });

    const first = inPeriod[0]!;
    const last = inPeriod.at(-1)!;
    if (inPeriod.length > 1 && first.volume > 0) {
      const percent = ((last.volume - first.volume) / first.volume) * 100;
      if (!mostImproved || percent > mostImproved.percent) mostImproved = { exercise, percent, since: first.session.date };
    }
  }

  prs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return {
    current,
    previous,
    workouts: days.size,
    previousWorkouts: previousDays.size,
    volume: Math.round(volume * 100) / 100,
    previousVolume: Math.round(previousVolume * 100) / 100,
    prs,
    mostImproved,
    lifts,
  };
}
