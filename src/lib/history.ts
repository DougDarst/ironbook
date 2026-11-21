/**
 * The History screen's content: one section per exercise, its finished
 * sessions oldest first, with a header per month (sessions, best volume,
 * PRs); each session's sets, top set, volume, change and PR flag. Pure functions, unit-tested in
 * history.test.ts. Volume, change and PRs come from the calc module.
 */
import {
  exerciseHistory,
  groupSets,
  monthSummaries,
  splitRamp,
  topSet,
  type Change,
  type LiftedSet,
  type MonthSummary,
  type Session,
} from './calc';
import { formatChange, formatPercent, formatVolume, formatWeight } from './format';
import { monthOf } from './model/dates';
import type { SetSlot } from './model/sets';

export interface HistorySession extends Session {
  /** The workout's id, to open it for editing. */
  workout: string;
}

export interface HistoryRow {
  kind: 'session';
  date: string;
  workout: string;
  /** The session's set slots (shown as chips, see setChips). */
  sets: readonly SetSlot[];
  /** The highest weight, with the most reps done at it; null when nothing was done. */
  top: LiftedSet | null;
  volume: number;
  change: Change | null;
  isPR: boolean;
}

export interface MonthRow {
  kind: 'month';
  /** "YYYY-MM". */
  month: string;
  /** Sessions, best volume and PRs that month. */
  summary: MonthSummary;
}

export interface HistorySection {
  exercise: { id: string; name: string };
  rows: (MonthRow | HistoryRow)[];
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "2026-09" → "September 2026". */
export function monthLabel(month: string): string {
  return `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

/** "2026-09-01" → "9/1" (the month header above gives the year). */
export function shortDate(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}

/** A top set as "205 × 5", or "—" when nothing was done. */
export function topSetText(top: LiftedSet | null): string {
  return top ? `${formatWeight(top.weight)} × ${top.reps}` : '—';
}

/** "4 sessions · best 23,685 · 3 PRs". */
export function monthSummaryText(m: MonthSummary): string {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return `${plural(m.sessions, 'session')} · best ${formatVolume(m.best)} · ${plural(m.prs, 'PR')}`;
}

/**
 * The Change cell: an arrow and the amount ("▲ 975", "▼ 415"; the arrow
 * says which way without relying on color), then the percentage ("+5%").
 * The first session shows "—" and "first session".
 */
export function changeText(change: Change | null): {
  direction: 'up' | 'down' | 'same' | 'first';
  amount: string;
  percent: string;
} {
  if (!change) return { direction: 'first', amount: '—', percent: 'first session' };
  const percent = formatPercent(change.percent);
  const rounded = Math.round(change.amount);
  if (rounded === 0) return { direction: 'same', amount: '0', percent };
  const amount = formatChange(Math.abs(change.amount)).replace(/^[+−]/, '');
  return rounded > 0 ? { direction: 'up', amount: `▲ ${amount}`, percent } : { direction: 'down', amount: `▼ ${amount}`, percent };
}

/** "2026-09-01" → "9/1/26", as in the sheet. */
export function sheetDate(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}/${date.slice(2, 4)}`;
}

/** How the History sets are shown (the toolbar's two toggles). */
export interface SetView {
  /** Show each warm-up set, or one "Ramp 45→145 · 11 sets" chip. */
  showRamp: boolean;
  /** Merge consecutive identical sets into one chip with a count. */
  grouped: boolean;
}

/** One chip in the Sets column. */
export type SetChip =
  /** The warm-up ramp, collapsed: its first and last weight and how many sets. */
  | { kind: 'ramp'; first: number; last: number; sets: number }
  /** One set, or `count` identical consecutive sets. Top = the day's top weight. */
  | { kind: 'set'; weight: number; reps: number; count: number; tone: 'ramp' | 'work' | 'top' };

/**
 * A session's done sets as chips: the warm-up ramp (collapsed into one chip,
 * or shown set by set), then the working sets; repeated sets grouped when
 * `grouped`. Working sets at the day's top weight are tinted (tone "top").
 */
export function setChips(slots: readonly SetSlot[], view: SetView): SetChip[] {
  const { ramp, work } = splitRamp(slots);
  const topWeight = topSet(slots)?.weight ?? null;
  const toChips = (sets: LiftedSet[], tone: (s: LiftedSet) => 'ramp' | 'work' | 'top'): SetChip[] =>
    (view.grouped ? groupSets(sets) : sets.map((s) => ({ ...s, count: 1 }))).map((g) => ({
      kind: 'set',
      weight: g.weight,
      reps: g.reps,
      count: g.count,
      tone: tone(g),
    }));
  const rampChips: SetChip[] =
    ramp.length === 0
      ? []
      : view.showRamp
        ? toChips(ramp, () => 'ramp')
        : [{ kind: 'ramp', first: ramp[0]!.weight, last: ramp.at(-1)!.weight, sets: ramp.length }];
  return [...rampChips, ...toChips(work, (s) => (s.weight === topWeight ? 'top' : 'work'))];
}

/** A chip's text: "195 × 4" with "×5" for a group; "Ramp 45→145" with "11 sets". */
export function chipText(chip: SetChip): { label: string; extra: string | null } {
  if (chip.kind === 'ramp') {
    const range = chip.first === chip.last ? formatWeight(chip.first) : `${formatWeight(chip.first)}→${formatWeight(chip.last)}`;
    return { label: `Ramp ${range}`, extra: `${chip.sets} ${chip.sets === 1 ? 'set' : 'sets'}` };
  }
  return { label: `${formatWeight(chip.weight)} × ${chip.reps}`, extra: chip.count > 1 ? `×${chip.count}` : null };
}

/**
 * Sections for the given exercises (alphabetical, ignoring case), skipping
 * those with no finished sessions. Pass one exercise to filter. Drafts never
 * appear; a month divider starts each month.
 */
export function buildHistory(
  sessions: readonly HistorySession[],
  exercises: readonly { id: string; name: string }[],
): HistorySection[] {
  const sorted = [...exercises].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const sections: HistorySection[] = [];
  for (const exercise of sorted) {
    const history = exerciseHistory(sessions, exercise.id);
    if (history.length === 0) continue;
    const summaries = new Map(monthSummaries(history).map((m) => [m.month, m]));
    const rows: (MonthRow | HistoryRow)[] = [];
    let month = '';
    for (const { session, volume, change, isPR } of history) {
      if (monthOf(session.date) !== month) {
        month = monthOf(session.date);
        rows.push({ kind: 'month', month, summary: summaries.get(month)! });
      }
      rows.push({
        kind: 'session',
        date: session.date,
        workout: session.workout,
        sets: session.sets,
        top: topSet(session.sets),
        volume,
        change,
        isPR,
      });
    }
    sections.push({ exercise, rows });
  }
  return sections;
}
