/**
 * The Metrics screen's choices and wording. Pure functions, unit-tested in
 * metrics.test.ts; numbers come from the calc module.
 */
import type { HistoryRow, Session } from './calc';
import { formatChange, formatPercent, formatShortDate } from './format';

/**
 * The exercise Metrics opens on: the one logged most recently (latest
 * finished session; on a tie, the first by name). Null with no finished
 * sessions.
 */
export function defaultExercise(sessions: readonly Session[], exercises: readonly { id: string; name: string }[]): string | null {
  let best: { date: string; name: string; id: string } | null = null;
  for (const s of sessions) {
    if (s.status !== 'finished') continue;
    const exercise = exercises.find((e) => e.id === s.exercise);
    if (!exercise) continue;
    const better =
      !best ||
      s.date > best.date ||
      (s.date === best.date && exercise.name.localeCompare(best.name, undefined, { sensitivity: 'base' }) < 0);
    if (better) best = { date: s.date, name: exercise.name, id: exercise.id };
  }
  return best?.id ?? null;
}

/**
 * The line under the headline volume: "Nov 10 · +1,110 (+4%) vs last time",
 * or "Nov 10 · first session". The percentage is left out when last time
 * was 0.
 */
export function headlineDetail(row: HistoryRow, today: string): string {
  const date = formatShortDate(row.session.date, today);
  if (!row.change) return `${date} · first session`;
  const percent = row.change.percent === null ? '' : ` (${formatPercent(row.change.percent)})`;
  return `${date} · ${formatChange(row.change.amount)}${percent} vs last time`;
}
