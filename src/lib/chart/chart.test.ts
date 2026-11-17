import { describe, expect, it } from 'vitest';
import {
  barPath,
  compactNumber,
  monthlyChart,
  monthTickLabel,
  monthTicks,
  nearestPoint,
  niceScale,
  rangeStart,
  volumeChart,
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

describe('rangeStart', () => {
  it('is 3 or 12 months back, or the first session', () => {
    expect(rangeStart('3M', '2026-11-16', '2020-01-01')).toBe('2026-08-16');
    expect(rangeStart('1Y', '2026-11-16', '2020-01-01')).toBe('2025-11-16');
    expect(rangeStart('All', '2026-11-16', '2020-01-01')).toBe('2020-01-01');
    expect(rangeStart('All', '2026-11-16', '2026-11-16')).toBe('2026-11-16');
  });
});

describe('volumeChart', () => {
  const frame: Frame = { width: 340, height: 220, left: 40, right: 10, top: 10, bottom: 30 };
  const session = (date: string, volume: number, isPR = false) => ({ date, volume, isPR });

  it('places sessions by date, from the range start (left edge) to today (right edge)', () => {
    const chart = volumeChart(
      [session('2026-11-16', 200), session('2026-08-16', 100), session('2026-10-01', 150)],
      '3M',
      '2026-11-16',
      frame,
    );
    expect(chart.points.map((p) => p.date)).toEqual(['2026-08-16', '2026-10-01', '2026-11-16']); // oldest first
    expect(chart.points[0]!.x).toBe(40);
    expect(chart.points[2]!.x).toBe(330);
    // Oct 1 is 46 of the 92 days in: halfway.
    expect(chart.points[1]!.x).toBeCloseTo(185, 5);
  });

  it('places volumes on the gridlines: higher volume, higher up', () => {
    const chart = volumeChart([session('2026-11-01', 100), session('2026-11-10', 200)], 'All', '2026-11-16', frame);
    expect(chart.yTicks.map((t) => t.label)).toEqual(['100', '150', '200']);
    expect(chart.yTicks[0]!.y).toBe(190); // the bottom
    expect(chart.yTicks.at(-1)!.y).toBe(10); // the top
    expect(chart.points.map((p) => p.y)).toEqual([190, 10]);
  });

  it('leaves out sessions before the range, and keeps PR flags', () => {
    const chart = volumeChart(
      [session('2026-01-05', 900, true), session('2026-09-01', 100), session('2026-11-01', 120, true)],
      '3M',
      '2026-11-16',
      frame,
    );
    expect(chart.points.map((p) => [p.date, p.isPR])).toEqual([
      ['2026-09-01', false],
      ['2026-11-01', true],
    ]);
  });

  it('draws a path through the points', () => {
    const chart = volumeChart([session('2026-11-01', 100), session('2026-11-16', 200)], 'All', '2026-11-16', frame);
    expect(chart.path).toBe('M40.0 190.0 L330.0 10.0');
  });

  it('puts a lone session (first session today) in the middle, without month labels', () => {
    const chart = volumeChart([session('2026-11-16', 500)], 'All', '2026-11-16', frame);
    expect(chart.points[0]!.x).toBe(185);
    expect(chart.xTicks).toEqual([]);
    expect(chart.points[0]!.y).toBeGreaterThan(10);
    expect(chart.points[0]!.y).toBeLessThan(190);
  });

  it('labels months at their x positions', () => {
    const chart = volumeChart([session('2026-07-01', 1), session('2026-11-16', 2)], 'All', '2026-11-16', frame);
    expect(chart.xTicks[0]).toEqual({ date: '2026-07-01', label: 'Jul', x: 40 });
    expect(chart.xTicks.map((t) => t.label)).toEqual(['Jul', 'Aug', 'Sep', 'Oct', 'Nov']);
  });

  it('has no points (and a sane scale) when the range has no sessions', () => {
    const chart = volumeChart([session('2025-01-01', 100)], '3M', '2026-11-16', frame);
    expect(chart.points).toEqual([]);
    expect(chart.path).toBe('');
    expect(chart.yTicks.every((t) => Number.isFinite(t.y))).toBe(true);
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

describe('barPath', () => {
  it('draws a bar down to the baseline with rounded top corners', () => {
    expect(barPath(10, 20, 30, 50, 6)).toBe('M10.0 70.0 V26.0 Q10.0 20.0 16.0 20.0 H34.0 Q40.0 20.0 40.0 26.0 V70.0 Z');
  });

  it('keeps the corners within a short or narrow bar', () => {
    expect(barPath(0, 0, 4, 50, 6)).toContain('Q0.0 0.0 2.0 0.0'); // radius ≤ half the width
    expect(barPath(0, 47, 30, 3, 6)).toContain('V50.0 Q0.0 47.0 3.0 47.0'); // radius ≤ the height
  });

  it('is empty for a bar with no height', () => {
    expect(barPath(10, 70, 30, 0, 6)).toBe('');
  });
});

describe('monthlyChart', () => {
  const frame: Frame = { width: 340, height: 200, left: 40, right: 10, top: 20, bottom: 30 };
  const months = (from: number, to: number, year = 2026) =>
    Array.from({ length: to - from + 1 }, (_, i) => `${year}-${String(from + i).padStart(2, '0')}`);
  const totals = (list: string[], volume = (i: number) => (i + 1) * 10_000) =>
    list.map((month, i) => ({ month, volume: volume(i), current: month === '2026-11' }));
  const counts = new Map([
    ['2026-10', 4],
    ['2026-11', 2],
  ]);

  it('shows the months of the range through this month, from 0', () => {
    const chart = monthlyChart(totals(months(1, 11)), counts, '3M', '2026-11-16', '2026-01-03', frame);
    expect(chart.bars.map((b) => b.month)).toEqual(['2026-08', '2026-09', '2026-10', '2026-11']);
    expect(chart.yTicks[0]!.value).toBe(0);
    expect(chart.yTicks[0]!.y).toBe(170); // the baseline
    expect(chart.bars.map((b) => b.sessions)).toEqual([0, 0, 4, 2]);
    expect(chart.bars.map((b) => b.current)).toEqual([false, false, false, true]);
  });

  it('All shows every month; 1Y the last 13', () => {
    const list = months(1, 12, 2025).concat(months(1, 11));
    expect(monthlyChart(totals(list), counts, 'All', '2026-11-16', '2025-01-05', frame).bars).toHaveLength(23);
    expect(monthlyChart(totals(list), counts, '1Y', '2026-11-16', '2025-01-05', frame).bars[0]!.month).toBe('2025-11');
  });

  it('makes taller bars for bigger totals, all on one baseline, side by side', () => {
    const chart = monthlyChart(totals(months(7, 11), (i) => [101_000, 90_000, 92_000, 118_000, 53_000][i]!), counts, 'All', '2026-11-16', '2026-07-01', frame);
    const [jul, aug, , oct, nov] = chart.bars;
    expect(oct!.height).toBeGreaterThan(jul!.height);
    expect(jul!.height).toBeGreaterThan(aug!.height);
    for (const b of chart.bars) expect(b.y + b.height).toBeCloseTo(170, 6);
    expect(chart.bars[1]!.x).toBeGreaterThan(jul!.x + jul!.width); // a gap between bars
    expect(nov!.x + nov!.width).toBeLessThanOrEqual(330);
  });

  it('labels every bar with its value and month when there are few', () => {
    const chart = monthlyChart(totals(months(7, 11), (i) => [101_000, 90_000, 0, 118_000, 53_000][i]!), counts, 'All', '2026-11-16', '2026-07-01', frame);
    expect(chart.bars.map((b) => b.valueLabel)).toEqual(['101k', '90k', null, '118k', '53k']); // none on an empty month
    expect(chart.bars.map((b) => b.monthLabel)).toEqual(['Jul', 'Aug', 'Sep', 'Oct', 'Nov']);
    expect(chart.bars[2]!.path).toBe('');
  });

  it('drops value labels and thins month labels when there are many bars', () => {
    const list = months(1, 12, 2025).concat(months(1, 11));
    const chart = monthlyChart(totals(list), counts, 'All', '2026-11-16', '2025-01-05', frame);
    expect(chart.bars.every((b) => b.valueLabel === null)).toBe(true);
    expect(chart.bars.filter((b) => b.monthLabel).map((b) => b.monthLabel)).toEqual(['2025', 'Apr', 'Jul', 'Oct', '2026', 'Apr', 'Jul', 'Oct']);
  });

  it('copes with a range that has only empty months', () => {
    const chart = monthlyChart(totals(months(10, 11), () => 0), counts, '3M', '2026-11-16', '2026-10-01', frame);
    expect(chart.bars.every((b) => b.height === 0)).toBe(true);
    expect(chart.yTicks.every((t) => Number.isFinite(t.y))).toBe(true);
  });
});
