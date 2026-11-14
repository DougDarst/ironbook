import { describe, expect, it } from 'vitest';
import { daysInMonth, isLeapYear, isValidDate } from './dates';

describe('isLeapYear', () => {
  it('follows the 4 / 100 / 400 rule', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });
});

describe('daysInMonth', () => {
  it('knows every month', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => daysInMonth(2026, m))).toEqual([
      31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ]);
    expect(daysInMonth(2028, 2)).toBe(29);
  });
});

describe('isValidDate', () => {
  it('accepts real dates', () => {
    for (const d of ['2026-11-13', '2026-01-01', '2026-12-31', '2028-02-29', '2000-02-29']) {
      expect(isValidDate(d), d).toBe(true);
    }
  });

  it('rejects impossible dates', () => {
    for (const d of ['2026-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-01-00', '2026-01-32']) {
      expect(isValidDate(d), d).toBe(false);
    }
  });

  it('rejects anything not exactly YYYY-MM-DD', () => {
    for (const d of ['2026-1-5', '26-01-05', '2026/01/05', '2026-01-05T00:00:00Z', ' 2026-01-05', '', null, 20260105]) {
      expect(isValidDate(d), String(d)).toBe(false);
    }
  });

  it('rejects years outside 1900–2999', () => {
    expect(isValidDate('1899-12-31')).toBe(false);
    expect(isValidDate('3000-01-01')).toBe(false);
  });
});
