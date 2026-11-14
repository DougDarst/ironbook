/**
 * Date-only values: "YYYY-MM-DD" strings. No timestamps, no time zones.
 * Dependency-free: also bundled into the PocketBase hooks.
 */

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** True for a real calendar date in "YYYY-MM-DD" form (e.g. not 2026-02-30). */
export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return year >= 1900 && year <= 2999 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/**
 * Today's date on this device, as "YYYY-MM-DD". Reads the local calendar
 * date; never does arithmetic on the timestamp.
 */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The month of a date: "2026-11-13" → "2026-11". */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** The month after a "YYYY-MM" month: "2026-12" → "2027-01". */
export function nextMonth(month: string): string {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, '0')}`;
}
