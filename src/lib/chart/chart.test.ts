import { describe, expect, it } from 'vitest';
import {
  compactNumber,
  indexChart,
  innerTicks,
  monthTickLabel,
  monthTicks,
  nearestPoint,
  niceScale,
  sessionChart,
  stackedBars,
  stepSelection,
  type Frame,
} from '.';

describe('niceScale', () => {
  it('covers the values with round steps, like the mockup (18k, 23k, 28k)', () => {
    expect(niceScale(18_500, 27_115).ticks).toEqual([15_000, 20_000, 25_000, 30_000]);
    expect(niceScale(18_500, 27_115, 2).ticks).toEqual([10_000, 20_000, 30_000]);
  });

  it('uses steps of 1, 2, 2.5 or 5 × a power of ten', () => {
    expect(niceScale(0, 100).ticks).toEqual([0, 50, 100]);
    expect(niceScale(0, 70).ticks).toEqual([0, 25, 50, 75]);
    expect(niceScale(1_020, 1_180).ticks).toEqual([1_000, 1_100, 1_200]);
    expect(niceScale(3.2, 3.9).ticks).toEqual([3, 3.5, 4]);
  });

  it('always includes min and max, in at most the given number of steps', () => {
    for (const [min, max] of [
      [1, 9],
      [123, 98_765],
      [40_001, 40_002],
      [0.5, 0.7],
    ] as const) {
      const { lower, upper, ticks } = niceScale(min, max);
      expect(lower).toBeLessThanOrEqual(min);
      expect(upper).toBeGreaterThanOrEqual(max);
      expect(ticks.length - 1).toBeLessThanOrEqual(3);
      expect(ticks[0]).toBe(lower);
      expect(ticks.at(-1)).toBe(upper);
    }
  });

  it('never goes below 0', () => {
    expect(niceScale(10, 2_000).lower).toBe(0);
    expect(niceScale(0, 0).lower).toBe(0);
  });

  it('gives equal values room around them', () => {
    const { lower, upper } = niceScale(25_000, 25_000);
    expect(lower).toBeLessThan(25_000);
    expect(upper).toBeGreaterThan(25_000);
    expect(niceScale(0, 0).upper).toBeGreaterThan(0);
  });
});

describe('compactNumber', () => {
  it('shortens thousands and millions', () => {
    expect(compactNumber(800)).toBe('800');
    expect(compactNumber(0)).toBe('0');
    expect(compactNumber(1_500)).toBe('1.5k');
    expect(compactNumber(28_000)).toBe('28k');
    expect(compactNumber(9_540)).toBe('9.5k');
    expect(compactNumber(27_115)).toBe('27k'); // whole from 10k up
    expect(compactNumber(117_900)).toBe('118k');
    expect(compactNumber(1_200_000)).toBe('1.2M');
    expect(compactNumber(999.6)).toBe('1000');
  });
});

describe('monthTicks', () => {
  it('labels each month start in the range', () => {
    expect(monthTicks('2026-07-01', '2026-11-16')).toEqual([
      { date: '2026-07-01', label: 'Jul' },
      { date: '2026-08-01', label: 'Aug' },
      { date: '2026-09-01', label: 'Sep' },
      { date: '2026-10-01', label: 'Oct' },
      { date: '2026-11-01', label: 'Nov' },
    ]);
  });

  it('starts at the next month when the range starts mid-month', () => {
    expect(monthTicks('2026-08-16', '2026-11-16').map((t) => t.label)).toEqual(['Sep', 'Oct', 'Nov']);
  });

  it('thins out long ranges on calendar-aligned months, showing years at January', () => {
    expect(monthTicks('2025-11-16', '2026-11-16').map((t) => t.label)).toEqual(['2026', 'Mar', 'May', 'Jul', 'Sep', 'Nov']);
    expect(monthTicks('2021-03-01', '2026-11-16').map((t) => t.label)).toEqual(['2022', '2023', '2024', '2025', '2026']);
  });

  it('is empty when no month starts in the range', () => {
    expect(monthTicks('2026-11-02', '2026-11-20')).toEqual([]);
  });

  it('labels January with its year', () => {
    expect(monthTickLabel('2027-01-01')).toBe('2027');
    expect(monthTickLabel('2027-12-01')).toBe('Dec');
  });
});

describe('nearestPoint', () => {
  it('finds the point closest to x', () => {
    const points = [{ x: 10 }, { x: 50 }, { x: 90 }];
    expect(nearestPoint(points, 0)).toBe(0);
    expect(nearestPoint(points, 69)).toBe(1);
    expect(nearestPoint(points, 71)).toBe(2);
    expect(nearestPoint([], 5)).toBe(-1);
  });
});

describe('innerTicks', () => {
  it('picks about three round values inside the range, like the mockup (20k, 22k, 24k)', () => {
    expect(innerTicks(18_732, 25_518)).toEqual([20_000, 22_000, 24_000]);
  });

  it('never goes outside the range, and uses steps of 1, 2 or 5 × a power of ten', () => {
    for (const [lo, hi] of [
      [0, 100],
      [950, 1_380],
      [2.4, 2.9],
      [40_100, 41_900],
    ] as const) {
      const ticks = innerTicks(lo, hi);
      expect(ticks.length).toBeGreaterThan(0);
      for (const t of ticks) expect(t >= lo && t <= hi, `${t} in ${lo}–${hi}`).toBe(true);
      if (ticks.length > 1) {
        const step = ticks[1]! - ticks[0]!;
        const mantissa = Math.round((step / 10 ** Math.floor(Math.log10(step))) * 1e6) / 1e6;
        expect([1, 2, 5]).toContain(mantissa);
      }
    }
  });

  it('gives one value for an empty range', () => {
    expect(innerTicks(5, 5)).toEqual([5]);
  });
});

describe('sessionChart', () => {
  const frame: Frame = { width: 340, height: 150, left: 40, right: 10, top: 10, bottom: 30 };
  const s = (date: string, volume: number, isPR = false) => ({ date, volume, isPR });

  it('spaces sessions evenly in order, ignoring the gaps between dates', () => {
    const chart = sessionChart([s('2026-07-02', 100), s('2026-07-03', 120), s('2026-09-30', 110)], frame);
    expect(chart.points.map((p) => p.x)).toEqual([40, 185, 330]);
  });

  it('crops the value axis to the data: the lowest and highest sit inside, off the edges', () => {
    const chart = sessionChart([s('2026-07-02', 19_200), s('2026-09-01', 25_050, true), s('2026-09-22', 23_300)], frame);
    const ys = chart.points.map((p) => p.y);
    expect(Math.max(...ys)).toBeLessThan(120); // lowest volume above the bottom (y = 120)
    expect(Math.min(...ys)).toBeGreaterThan(10); // highest below the top
    expect(chart.points[1]!.y).toBeLessThan(chart.points[2]!.y); // 25,050 higher than 23,300
    expect(chart.yTicks.map((t) => t.label)).toEqual(['20k', '22k', '24k']);
    expect(chart.points[1]!.isPR).toBe(true);
  });

  it('labels every session M/D when they fit, else every k-th, always the latest', () => {
    const few = sessionChart([s('2026-07-02', 1), s('2026-07-09', 2)], frame);
    expect(few.xLabels.map((l) => l.label)).toEqual(['7/2', '7/9']);
    const dates = Array.from({ length: 20 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`);
    const many = sessionChart(dates.map((d, i) => s(d, i + 1)), frame);
    expect(many.xLabels.length).toBeLessThanOrEqual(7); // (330 − 40) / 48 + 1
    expect(many.xLabels.at(-1)!.label).toBe('8/20');
  });

  it('centres a single session and copes with none', () => {
    expect(sessionChart([s('2026-07-02', 500)], frame).points[0]!.x).toBe(185);
    const empty = sessionChart([], frame);
    expect([empty.points, empty.path, empty.xLabels]).toEqual([[], '', []]);
  });
});

describe('stepSelection', () => {
  it('steps with the arrows, jumps with Home and End, clears with Escape', () => {
    expect(stepSelection('ArrowRight', null, 3)).toBe(0);
    expect(stepSelection('ArrowRight', 2, 3)).toBe(2);
    expect(stepSelection('ArrowLeft', null, 3)).toBe(2);
    expect(stepSelection('ArrowLeft', 0, 3)).toBe(0);
    expect(stepSelection('Home', 1, 3)).toBe(0);
    expect(stepSelection('End', 0, 3)).toBe(2);
    expect(stepSelection('Escape', 1, 3)).toBeNull();
    expect(stepSelection('a', 1, 3)).toBeUndefined();
    expect(stepSelection('ArrowRight', null, 0)).toBeUndefined();
  });
});

describe('stackedBars', () => {
  const frame: Frame = { width: 340, height: 200, left: 40, right: 0, top: 20, bottom: 30 };
  const order = (id: string) => ({ bench: 1, squat: 2, row: 3 })[id] ?? 99;
  const days = [
    { date: '2026-11-02', lifts: [{ exercise: 'squat', volume: 20_000 }, { exercise: 'bench', volume: 10_000 }], total: 30_000, hasPR: true },
    { date: '2026-11-09', lifts: [{ exercise: 'bench', volume: 15_000 }], total: 15_000, hasPR: false },
  ];
  const chart = stackedBars(days, order, frame);

  it('stacks each day’s lifts bottom up in colour order, 2 px apart, from 0', () => {
    const [first] = chart.bars;
    expect(first!.segments.map((s) => s.exercise)).toEqual(['bench', 'squat']);
    const [bench, squat] = first!.segments;
    expect(bench!.y + bench!.height).toBe(170); // on the baseline
    expect(squat!.y + squat!.height).toBeCloseTo(bench!.y - 2, 6); // a 2 px gap
    expect(chart.yTicks[0]).toMatchObject({ value: 0, y: 170 });
    expect(first!.top).toBe(squat!.y);
    expect(first!.hasPR).toBe(true);
  });

  it('makes a taller bar for a bigger day, one bar per day, side by side', () => {
    const [a, b] = chart.bars;
    expect(170 - a!.top).toBeGreaterThan(170 - b!.top);
    expect(b!.x).toBeGreaterThan(a!.x + a!.width);
    expect(chart.xLabels.map((l) => l.label)).toEqual(['11/2', '11/9']);
  });

  it('draws nothing for a lift that lifted nothing, and copes with no days', () => {
    const z = stackedBars([{ date: '2026-11-02', lifts: [{ exercise: 'row', volume: 0 }], total: 0, hasPR: false }], order, frame);
    expect(z.bars[0]!.segments).toEqual([]);
    expect(stackedBars([], order, frame).bars).toEqual([]);
  });
});

describe('indexChart', () => {
  const frame: Frame = { width: 340, height: 200, left: 40, right: 0, top: 20, bottom: 30 };
  const period = { start: '2026-11-01', end: '2026-11-21' };
  const chart = indexChart(
    [
      { exercise: 'bench', points: [{ date: '2026-11-01', index: 100 }, { date: '2026-11-21', index: 150 }] },
      { exercise: 'squat', points: [{ date: '2026-11-11', index: 100 }, { date: '2026-11-21', index: 90 }] },
    ],
    period,
    frame,
  );

  it('places points by date across the period', () => {
    const [bench, squat] = chart.lines;
    expect(bench!.points.map((p) => p.x)).toEqual([40, 340]);
    expect(squat!.points[0]!.x).toBe(190); // halfway through the period
  });

  it('puts 100% on a dashed baseline, higher % higher up', () => {
    const [bench, squat] = chart.lines;
    expect(bench!.points[0]!.y).toBeCloseTo(chart.baseline, 6);
    expect(bench!.points[1]!.y).toBeLessThan(chart.baseline);
    expect(squat!.points[1]!.y).toBeGreaterThan(chart.baseline);
    expect(chart.yTicks.every((t) => t.label.endsWith('%'))).toBe(true);
    expect(chart.lines[0]!.path.startsWith('M40.0')).toBe(true);
  });

  it('labels the months of the period', () => {
    expect(chart.xTicks.map((t) => t.label)).toEqual(['Nov']);
  });
});
