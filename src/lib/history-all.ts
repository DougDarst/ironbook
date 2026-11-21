/**
 * Wording for History's "All exercises" view (redesign Story 5): the period
 * header, the four summary cards and the by-exercise rows. Pure functions,
 * unit-tested in history-all.test.ts; the numbers come from periodSummary.
 */
import type { PeriodKind, PeriodSummary } from './calc';
import { formatVolume } from './format';
import { shortDate, type SummaryCardView } from './history';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = [
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
const mon = (date: string) => MONTHS[Number(date.slice(5, 7)) - 1]!;
const day = (date: string) => Number(date.slice(8, 10));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "Nov 1–20" or "Aug 23 – Nov 20" (a period's dates, compactly). */
export function rangeText(start: string, end: string): string {
  return start.slice(0, 7) === end.slice(0, 7)
    ? `${mon(start)} ${day(start)}–${day(end)}`
    : `${mon(start)} ${day(start)} – ${mon(end)} ${day(end)}`;
}

/** What the period is compared with: "Oct 1–20", or "the previous 90 days". */
export function previousText(summary: PeriodSummary, kind: PeriodKind): string {
  return kind === 'month' ? rangeText(summary.previous.start, summary.previous.end) : 'the previous 90 days';
}

/** "November 2026 · 3 lifts · weights in lbs", or "Aug 23 – Nov 20 · 3 lifts · weights in lbs". */
export function periodSubline(summary: PeriodSummary, kind: PeriodKind): string {
  const when =
    kind === 'month'
      ? `${MONTH_NAMES[Number(summary.current.start.slice(5, 7)) - 1]} ${summary.current.start.slice(0, 4)}`
      : rangeText(summary.current.start, summary.current.end);
  return `${when} · ${plural(summary.lifts.length, 'lift')} · weights in lbs`;
}

/** "▲ 2", "▼ 15%", or null for no change; with which way it went. */
function delta(difference: number, suffix = ''): { text: string; trend: 'up' | 'down' } | null {
  if (difference === 0) return null;
  return difference > 0
    ? { text: `▲ ${difference.toLocaleString('en-US')}${suffix}`, trend: 'up' }
    : { text: `▼ ${Math.abs(difference).toLocaleString('en-US')}${suffix}`, trend: 'down' };
}

/** A lift's volume against the previous period: "▲ 36%", "▼ 5%", "Same", or "New" when it had none. */
export function versusPrevious(volume: number, previousVolume: number): { text: string; trend: 'up' | 'down' | null } {
  if (previousVolume <= 0) return { text: 'New', trend: null };
  const d = delta(Math.round(((volume - previousVolume) / previousVolume) * 100), '%');
  return d ?? { text: 'Same', trend: null };
}

/** The four cards: Workouts, Total volume, PRs this period, Most improved. */
export function periodCards(summary: PeriodSummary, kind: PeriodKind, names: ReadonlyMap<string, string>): SummaryCardView[] {
  const vs = previousText(summary, kind);
  const name = (id: string) => names.get(id) ?? '';

  const workouts = delta(summary.workouts - summary.previousWorkouts);
  const volume =
    summary.previousVolume > 0 ? delta(Math.round(((summary.volume - summary.previousVolume) / summary.previousVolume) * 100), '%') : null;
  const volumeSub =
    summary.previousVolume <= 0 ? `Nothing logged in ${vs}` : volume ? `${volume.text} vs ${vs}` : `Same as ${vs}`;

  const shown = summary.prs.slice(0, 3).map((p) => `${name(p.exercise)} ${shortDate(p.date)}`);
  const more = summary.prs.length > 3 ? ` · +${summary.prs.length - 3} more` : '';

  return [
    {
      label: 'Workouts',
      value: String(summary.workouts),
      valueSuffix: null,
      sub: workouts ? `${workouts.text} vs ${vs}` : `Same as ${vs}`,
      tone: 'default',
      trend: workouts?.trend ?? null,
    },
    {
      label: 'Total volume',
      value: formatVolume(summary.volume),
      valueSuffix: null,
      sub: volumeSub,
      tone: 'default',
      trend: volume?.trend ?? null,
    },
    {
      label: kind === 'month' ? 'PRs this month' : 'PRs · last 90 days',
      value: String(summary.prs.length),
      valueSuffix: null,
      sub: summary.prs.length > 0 ? shown.join(' · ') + more : 'None yet',
      tone: summary.prs.length > 0 ? 'pr' : 'default',
      trend: null,
    },
    summary.mostImproved
      ? {
          label: 'Most improved',
          value: `${summary.mostImproved.percent >= 0 ? '+' : '−'}${Math.abs(Math.round(summary.mostImproved.percent))}%`,
          valueSuffix: null,
          sub: `${name(summary.mostImproved.exercise)} · session volume since ${shortDate(summary.mostImproved.since)}`,
          tone: 'default',
          trend: null,
        }
      : {
          label: 'Most improved',
          value: '—',
          valueSuffix: null,
          sub: 'Needs two sessions of a lift',
          tone: 'default',
          trend: null,
        },
  ];
}
