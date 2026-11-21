/**
 * The History screen's content: one section per exercise, its finished
 * sessions newest first, with a header per month (sessions, best volume,
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
  type ExerciseSummary,
  type LiftedSet,
  type MonthSummary,
  type Session,
} from './calc';
import { formatChange, formatLongDate, formatPercent, formatVolume, formatWeight } from './format';
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
 * appear. Newest first: the latest month at the top, the latest session
 * first within it (spec Decisions, 2026-11-20); each row's change and PR
 * still compare with the sessions before it.
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
    for (const { session, volume, change, isPR } of [...history].reverse()) {
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

/** "13 sessions since Jul 2, 2026 · weights in lbs", under the exercise's name. */
export function exerciseSubline(summary: ExerciseSummary): string {
  const n = summary.sessions;
  return `${n} ${n === 1 ? 'session' : 'sessions'} since ${formatLongDate(summary.firstDate)} · weights in lbs`;
}

/** One summary card: its label, value (and a smaller part after it), the line below, and how to show it. */
export interface SummaryCardView {
  label: string;
  value: string;
  valueSuffix: string | null;
  sub: string;
  /** "pr" = the green PR card. */
  tone: 'default' | 'pr';
  /** Colours the line below green (up) or red (down). */
  trend: 'up' | 'down' | null;
}

/**
 * The four summary cards: Latest volume, Best volume · PR, Heaviest top set,
 * Volume PRs (redesign §4.2).
 */
export function summaryCards(s: ExerciseSummary): SummaryCardView[] {
  const change = changeText(s.latest.change);
  const latestSub =
    change.direction === 'first'
      ? `First session · ${shortDate(s.latest.date)}`
      : `${change.amount}${change.percent ? ` (${change.percent})` : ''} · ${shortDate(s.latest.date)}`;
  const bestTop = s.best.top ? ` · ${topSetText(s.best.top)}${s.best.topCount > 1 ? ` × ${s.best.topCount}` : ''}` : '';

  let heaviestSub = 'No sets done yet';
  if (s.heaviest && s.firstTop) {
    const same = s.heaviest.top.weight === s.firstTop.top.weight && s.heaviest.top.reps === s.firstTop.top.reps;
    const month = MONTHS[Number(s.firstTop.date.slice(5, 7)) - 1]!;
    const when = s.firstTop.date.slice(0, 4) === s.heaviest.date.slice(0, 4) ? month : `${month} ${s.firstTop.date.slice(0, 4)}`;
    heaviestSub = same ? 'Same as your first session' : `Up from ${topSetText(s.firstTop.top)} in ${when}`;
  }

  return [
    {
      label: 'Latest volume',
      value: formatVolume(s.latest.volume),
      valueSuffix: null,
      sub: latestSub,
      tone: 'default',
      trend: change.direction === 'up' ? 'up' : change.direction === 'down' ? 'down' : null,
    },
    // With no volume PR (only 0 lb sessions, e.g. bodyweight lifts) the best
    // session isn't a PR, so the card drops the PR label and green.
    s.prs > 0
      ? {
          label: 'Best volume · PR',
          value: formatVolume(s.best.volume),
          valueSuffix: null,
          sub: `Set on ${shortDate(s.best.date)}${bestTop}`,
          tone: 'pr',
          trend: null,
        }
      : {
          label: 'Best volume',
          value: formatVolume(s.best.volume),
          valueSuffix: null,
          sub: 'No volume PR yet',
          tone: 'default',
          trend: null,
        },
    {
      label: 'Heaviest top set',
      value: topSetText(s.heaviest?.top ?? null),
      valueSuffix: null,
      sub: heaviestSub,
      tone: 'default',
      trend: null,
    },
    {
      label: 'Volume PRs',
      value: String(s.prs),
      valueSuffix: `of ${s.sessions}`,
      sub: s.vsFirst === null ? (s.sessions === 1 ? 'First session' : '') : `${formatPercent(s.vsFirst)} vs first session`,
      tone: 'default',
      trend: null,
    },
  ];
}

/**
 * The lift History opens on: the one logged most recently (latest finished
 * session; on a tie, the first by name). Null with no finished sessions.
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
