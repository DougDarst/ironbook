/**
 * The geometry of the hand-built SVG charts (spec Decisions, Story 17):
 * scales, gridlines, axis labels and point positions. Pure and
 * dependency-free, unit-tested in chart.test.ts; the Svelte components only
 * draw what these return. Dates are "YYYY-MM-DD" strings, spaced with the
 * calendar arithmetic in model/dates (never timestamps).
 */
import { dayNumber, monthsBefore } from '../model/dates';

/** Gridline values for a value axis, and the range they span. */
export interface NiceScale {
  lower: number;
  upper: number;
  ticks: number[];
}

/**
 * Round gridline values covering `min`..`max` in at most `maxIntervals`
 * steps of 1, 2, 2.5 or 5 × a power of ten (e.g. 18k, 23k, 28k), never
 * below 0. Equal values get some room around them.
 */
export function niceScale(min: number, max: number, maxIntervals = 3): NiceScale {
  let lo = Math.max(0, Math.min(min, max));
  let hi = Math.max(min, max, 0);
  if (hi - lo < 1e-9) {
    const pad = Math.max(1, hi * 0.1);
    lo = Math.max(0, lo - pad);
    hi += pad;
  }
  const rough = (hi - lo) / maxIntervals;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  for (const factor of [1, 2, 2.5, 5, 10, 20]) {
    const step = factor * magnitude;
    const lower = round(Math.floor(lo / step + 1e-9) * step);
    const upper = round(Math.ceil(hi / step - 1e-9) * step);
    if (Math.round((upper - lower) / step) <= maxIntervals) {
      const count = Math.round((upper - lower) / step);
      return { lower, upper, ticks: Array.from({ length: count + 1 }, (_, i) => round(lower + i * step)) };
    }
  }
  /* v8 ignore next */
  throw new Error('unreachable: a step of 20 × magnitude always fits');
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** A short axis label: 800, "1.5k", "28k", "1.2M". */
export function compactNumber(n: number): string {
  const trim = (x: number) => String(Math.round(x * 10) / 10);
  if (Math.abs(n) >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (Math.abs(n) >= 1_000) return `${trim(n / 1_000)}k`;
  return String(Math.round(n));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Jan", "Feb"…; January shows the year instead ("2026"), so years are clear. */
export function monthTickLabel(date: string): string {
  return date.slice(5, 7) === '01' ? date.slice(0, 4) : MONTHS[Number(date.slice(5, 7)) - 1]!;
}

/**
 * Labels for the first days of the months from `start` to `end`, at most
 * `max` of them: every month, or every 2nd, 3rd, 6th or 12th (aligned to the
 * calendar: Jan/Apr/Jul/Oct, Januaries…) when there are too many.
 */
export function monthTicks(start: string, end: string, max = 6): { date: string; label: string }[] {
  const index = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
  const firstDay = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`;
  const from = start.endsWith('-01') ? index(start) : index(start) + 1;
  const to = index(end);
  if (to < from) return [];
  for (const step of [1, 2, 3, 6, 12, 24, 60, 120]) {
    const picked: number[] = [];
    for (let i = from; i <= to; i += 1) if (i % step === 0) picked.push(i);
    if (picked.length <= max) return picked.map((i) => ({ date: firstDay(i), label: monthTickLabel(firstDay(i)) }));
  }
  return [];
}

export type Range = '3M' | '1Y' | 'All';
export const RANGES: readonly Range[] = ['3M', '1Y', 'All'];

/** The first date a range shows: 3 or 12 months before today, or the first session for All. */
export function rangeStart(range: Range, today: string, firstSession: string): string {
  if (range === '3M') return monthsBefore(today, 3);
  if (range === '1Y') return monthsBefore(today, 12);
  return firstSession < today ? firstSession : today;
}

/** Where the chart is drawn inside its box (room for the axis labels). */
export interface Frame {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ChartPoint {
  date: string;
  volume: number;
  isPR: boolean;
  x: number;
  y: number;
}

export interface VolumeChart {
  points: ChartPoint[];
  /** SVG path through the points, oldest first. */
  path: string;
  /** Gridlines: value, label and y. */
  yTicks: { value: number; label: string; y: number }[];
  /** Month labels: x and text. */
  xTicks: { date: string; label: string; x: number }[];
}

/**
 * The volume-per-session line chart: the sessions in the range (oldest
 * first) placed by date from the range's start to today, and by volume on
 * round gridlines. One session (or one day) sits in the middle.
 */
export function volumeChart(
  sessions: readonly { date: string; volume: number; isPR: boolean }[],
  range: Range,
  today: string,
  frame: Frame,
): VolumeChart {
  const all = [...sessions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const start = rangeStart(range, today, all[0]?.date ?? today);
  const shown = all.filter((s) => s.date >= start && s.date <= today);
  const volumes = shown.length > 0 ? shown.map((s) => s.volume) : [0];
  const scale = niceScale(Math.min(...volumes), Math.max(...volumes));

  const x0 = frame.left;
  const x1 = frame.width - frame.right;
  const y0 = frame.height - frame.bottom;
  const y1 = frame.top;
  const d0 = dayNumber(start);
  const span = dayNumber(today) - d0;
  const xOf = (date: string) => (span === 0 ? (x0 + x1) / 2 : x0 + ((dayNumber(date) - d0) / span) * (x1 - x0));
  const yOf = (v: number) => y0 - ((v - scale.lower) / (scale.upper - scale.lower)) * (y0 - y1);

  const points = shown.map((s) => ({ ...s, x: xOf(s.date), y: yOf(s.volume) }));
  return {
    points,
    path: points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '),
    yTicks: scale.ticks.map((value) => ({ value, label: compactNumber(value), y: yOf(value) })),
    xTicks: span === 0 ? [] : monthTicks(start, today).map((t) => ({ ...t, x: xOf(t.date) })),
  };
}

/** The index of the point nearest to `x` (for tapping or hovering the chart), or -1 without points. */
export function nearestPoint(points: readonly { x: number }[], x: number): number {
  let best = -1;
  for (let i = 0; i < points.length; i += 1) {
    if (best < 0 || Math.abs(points[i]!.x - x) < Math.abs(points[best]!.x - x)) best = i;
  }
  return best;
}
