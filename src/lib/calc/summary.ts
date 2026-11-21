/**
 * One exercise at a glance, for History's summary cards (redesign Story 4):
 * the latest session, the best, the heaviest top set, and the PR count.
 * Pure and dependency-free; unit-tested in history-redesign.test.ts.
 */
import type { Change, HistoryRow } from './history';
import { liftedSets, topSet, type LiftedSet } from './sets';

export interface ExerciseSummary {
  sessions: number;
  /** The first session's date. */
  firstDate: string;
  latest: { date: string; volume: number; change: Change | null };
  /** The highest-volume session (the earliest, on a tie). */
  best: { date: string; volume: number; top: LiftedSet | null; topCount: number };
  /** The heaviest top set (then most reps; the earliest on a tie), or null if nothing was lifted. */
  heaviest: { date: string; top: LiftedSet } | null;
  /** The first session's top set, to compare with the heaviest. */
  firstTop: { date: string; top: LiftedSet } | null;
  prs: number;
  /** The latest volume vs the first, in percent (exact); null with one session or a first volume of 0. */
  vsFirst: number | null;
}

/** How many done sets match the top set (same weight and reps). */
function topCount(slots: HistoryRow['session']['sets'], top: LiftedSet | null): number {
  if (!top) return 0;
  return liftedSets(slots).filter((s) => s.weight === top.weight && s.reps === top.reps).length;
}

/** Summarises an exercise's history (exerciseHistory's rows, oldest first); null without sessions. */
export function exerciseSummary(rows: readonly HistoryRow[]): ExerciseSummary | null {
  const first = rows[0];
  const last = rows.at(-1);
  if (!first || !last) return null;

  let best = first;
  let heaviest: ExerciseSummary['heaviest'] = null;
  let firstTop: ExerciseSummary['firstTop'] = null;
  for (const row of rows) {
    if (row.volume > best.volume) best = row;
    const top = topSet(row.session.sets);
    if (!top) continue;
    if (!firstTop) firstTop = { date: row.session.date, top };
    if (!heaviest || top.weight > heaviest.top.weight || (top.weight === heaviest.top.weight && top.reps > heaviest.top.reps)) {
      heaviest = { date: row.session.date, top };
    }
  }
  const bestTop = topSet(best.session.sets);
  return {
    sessions: rows.length,
    firstDate: first.session.date,
    latest: { date: last.session.date, volume: last.volume, change: last.change },
    best: { date: best.session.date, volume: best.volume, top: bestTop, topCount: topCount(best.session.sets, bestTop) },
    heaviest,
    firstTop,
    prs: rows.filter((r) => r.isPR).length,
    vsFirst: rows.length > 1 && first.volume > 0 ? ((last.volume - first.volume) / first.volume) * 100 : null,
  };
}
