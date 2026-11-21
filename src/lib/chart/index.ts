/**
 * The geometry of the hand-built SVG charts (spec Decisions, Story 17):
 * scales, gridlines, axis labels and point positions. Pure and
 * dependency-free, unit-tested in chart.test.ts; the Svelte components only
 * draw what these return. Dates are "YYYY-MM-DD" strings, spaced with the
 * calendar arithmetic in model/dates (never timestamps).
 */
import { dayNumber } from '../model/dates';

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

/** A short label: 800, "1.5k", "9.5k", "118k" (whole from 10k up), "1.2M". */
export function compactNumber(n: number): string {
  const trim = (x: number) => String(Math.round(x * 10) / 10);
  if (Math.abs(n) >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1_000)}k`;
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

/** The index of the point nearest to `x` (for tapping or hovering the chart), or -1 without points. */
export function nearestPoint(points: readonly { x: number }[], x: number): number {
  let best = -1;
  for (let i = 0; i < points.length; i += 1) {
    if (best < 0 || Math.abs(points[i]!.x - x) < Math.abs(points[best]!.x - x)) best = i;
  }
  return best;
}

/**
 * About `target` round gridline values inside `lo`..`hi` (not stretching the
 * range): steps of 1, 2 or 5 × a power of ten, whichever gives the count
 * closest to `target` (the wider step on a tie). E.g. 18,700–25,500 → 20k,
 * 22k, 24k.
 */
export function innerTicks(lo: number, hi: number, target = 3): number[] {
  if (!(hi > lo)) return [round(lo)];
  const ticksFor = (step: number) => {
    const out: number[] = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(round(v));
    return out;
  };
  const magnitude = 10 ** Math.floor(Math.log10((hi - lo) / target));
  let best: number[] = [];
  for (const factor of [0.5, 1, 2, 5, 10, 20]) {
    const ticks = ticksFor(factor * magnitude);
    if (ticks.length === 0) continue;
    if (best.length === 0 || Math.abs(ticks.length - target) <= Math.abs(best.length - target)) best = ticks;
  }
  return best;
}

export interface SessionChart {
  points: ChartPoint[];
  path: string;
  /** Gridlines inside the data's range (the axis is cropped to the data). */
  yTicks: { value: number; label: string; y: number }[];
  /** Session dates under their points ("7/2"), thinned to fit. */
  xLabels: { date: string; label: string; x: number }[];
}

/**
 * History's volume-per-session chart (redesign Story 4): one point per
 * session, evenly spaced in date order, the value axis cropped to the data
 * with a little room above and below. Every session gets its M/D label
 * when they fit, otherwise every k-th, always including the latest.
 */
export function sessionChart(
  sessions: readonly { date: string; volume: number; isPR: boolean }[],
  frame: Frame,
  labelWidth = 48,
): SessionChart {
  const x0 = frame.left;
  const x1 = frame.width - frame.right;
  const y0 = frame.height - frame.bottom;
  const y1 = frame.top;
  const volumes = sessions.length > 0 ? sessions.map((s) => s.volume) : [0];
  let lo = Math.min(...volumes);
  let hi = Math.max(...volumes);
  const pad = hi > lo ? (hi - lo) * 0.08 : Math.max(1, hi * 0.1);
  lo = Math.max(0, lo - pad);
  hi += pad;
  const n = sessions.length;
  const xOf = (i: number) => (n <= 1 ? (x0 + x1) / 2 : x0 + (i / (n - 1)) * (x1 - x0));
  const yOf = (v: number) => y0 - ((v - lo) / (hi - lo)) * (y0 - y1);
  const points = sessions.map((s, i) => ({ ...s, x: xOf(i), y: yOf(s.volume) }));
  const fit = Math.max(1, Math.floor((x1 - x0) / labelWidth) + 1);
  const every = Math.ceil(n / fit);
  return {
    points,
    path: points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '),
    yTicks: innerTicks(lo, hi).map((value) => ({ value, label: compactNumber(value), y: yOf(value) })),
    xLabels: points
      .filter((_, i) => (n - 1 - i) % every === 0)
      .map((p) => ({ date: p.date, label: `${Number(p.date.slice(5, 7))}/${Number(p.date.slice(8, 10))}`, x: p.x })),
  };
}

/**
 * Keyboard reading of a chart: the arrow keys step through its points,
 * Home and End jump to the ends, Escape hides the label. Returns the new
 * selection (null = none), or undefined for keys the chart doesn't use.
 */
export function stepSelection(key: string, selected: number | null, count: number): number | null | undefined {
  if (key === 'Escape') return null;
  if (count === 0) return undefined;
  const last = count - 1;
  switch (key) {
    case 'ArrowRight':
      return Math.min(last, (selected ?? -1) + 1);
    case 'ArrowLeft':
      return Math.max(0, (selected ?? last + 1) - 1);
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return undefined;
  }
}

export interface StackedBar {
  date: string;
  x: number;
  width: number;
  /** One rectangle per lift, bottom up, with a small gap between them. */
  segments: { exercise: string; volume: number; y: number; height: number }[];
  /** The top of the bar (for the PR dot above it). */
  top: number;
  hasPR: boolean;
}

/**
 * "Volume per workout" (redesign Story 6): a bar per workout day, each
 * lift a segment, bottom up in `order`, 2 px apart; from 0 up to round
 * gridlines; M/D labels thinned to fit.
 */
export function stackedBars(
  days: readonly { date: string; lifts: readonly { exercise: string; volume: number }[]; total: number; hasPR: boolean }[],
  order: (exercise: string) => number,
  frame: Frame,
  labelWidth = 44,
): { bars: StackedBar[]; yTicks: { value: number; label: string; y: number }[]; xLabels: { date: string; label: string; x: number }[] } {
  const GAP = 2;
  const x0 = frame.left;
  const x1 = frame.width - frame.right;
  const y0 = frame.height - frame.bottom;
  const y1 = frame.top;
  const scale = niceScale(0, Math.max(0, ...days.map((d) => d.total)), 3);
  const yOf = (v: number) => y0 - (v / scale.upper) * (y0 - y1);
  const band = days.length > 0 ? (x1 - x0) / days.length : 0;
  const width = Math.min(58, band * 0.7);
  const bars = days.map((day, i) => {
    const x = x0 + i * band + (band - width) / 2;
    let base = y0;
    const segments = [...day.lifts]
      .sort((a, b) => order(a.exercise) - order(b.exercise))
      .filter((l) => l.volume > 0)
      .map((l, k) => {
        const full = y0 - yOf(l.volume);
        const height = Math.max(0, full - (k > 0 ? GAP : 0));
        const top = base - (k > 0 ? GAP : 0) - height;
        const seg = { exercise: l.exercise, volume: l.volume, y: top, height };
        base = top;
        return seg;
      });
    return { date: day.date, x, width, segments, top: base, hasPR: day.hasPR };
  });
  const fit = Math.max(1, Math.floor((x1 - x0) / labelWidth));
  const every = Math.ceil(days.length / fit);
  return {
    bars,
    yTicks: scale.ticks.map((value) => ({ value, label: compactNumber(value), y: yOf(value) })),
    xLabels: bars
      .filter((_, i) => (days.length - 1 - i) % every === 0)
      .map((b) => ({ date: b.date, label: `${Number(b.date.slice(5, 7))}/${Number(b.date.slice(8, 10))}`, x: b.x + b.width / 2 })),
  };
}

/**
 * "Progress by lift" (redesign Story 6): each lift's sessions as a % of
 * its first one in the period, placed by date across the period, with
 * gridlines inside the range (always showing 100%) and a dashed 100% line.
 */
export function indexChart(
  series: readonly { exercise: string; points: readonly { date: string; index: number }[] }[],
  period: { start: string; end: string },
  frame: Frame,
): {
  lines: { exercise: string; path: string; points: { date: string; index: number; x: number; y: number }[] }[];
  yTicks: { value: number; label: string; y: number }[];
  baseline: number;
  xTicks: { date: string; label: string; x: number }[];
} {
  const x0 = frame.left;
  const x1 = frame.width - frame.right;
  const y0 = frame.height - frame.bottom;
  const y1 = frame.top;
  const values = [100, ...series.flatMap((s) => s.points.map((p) => p.index))];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const pad = Math.max(2, (hi - lo) * 0.08);
  lo = Math.max(0, lo - pad);
  hi += pad;
  const d0 = dayNumber(period.start);
  const span = Math.max(1, dayNumber(period.end) - d0);
  const xOf = (date: string) => x0 + ((dayNumber(date) - d0) / span) * (x1 - x0);
  const yOf = (v: number) => y0 - ((v - lo) / (hi - lo)) * (y0 - y1);
  const lines = series.map((s) => {
    const points = s.points.map((p) => ({ ...p, x: xOf(p.date), y: yOf(p.index) }));
    return {
      exercise: s.exercise,
      points,
      path: points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '),
    };
  });
  return {
    lines,
    yTicks: innerTicks(lo, hi).map((value) => ({ value, label: `${Math.round(value)}%`, y: yOf(value) })),
    baseline: yOf(100),
    xTicks: monthTicks(period.start, period.end, 6).map((t) => ({ ...t, x: xOf(t.date) })),
  };
}
