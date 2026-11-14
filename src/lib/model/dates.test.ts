import { describe, expect, it } from 'vitest';
import { daysInMonth, isLeapYear, isValidDate, localToday, monthOf, nextMonth } from './dates';

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

describe('localToday', () => {
  it("uses the device's local calendar date", () => {
    // Late evening local time: still the same calendar day locally.
    expect(localToday(new Date(2026, 10, 13, 23, 59))).toBe('2026-11-13');
    expect(localToday(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });
});

describe('monthOf / nextMonth', () => {
  it('takes the month of a date', () => {
    expect(monthOf('2026-11-13')).toBe('2026-11');
  });

  it('steps to the next month, across years', () => {
    expect(nextMonth('2026-11')).toBe('2026-12');
    expect(nextMonth('2026-12')).toBe('2027-01');
    expect(nextMonth('2026-09')).toBe('2026-10');
  });
});
