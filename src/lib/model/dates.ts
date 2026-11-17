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

/**
 * A date as a count of days (1970-01-01 is 0), from the calendar alone: for
 * spacing dates on a chart and counting the days between them. Pure
 * arithmetic (Howard Hinnant's days_from_civil), no timestamps.
 */
export function dayNumber(date: string): number {
  let y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  if (m <= 2) y -= 1;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/**
 * The same day `months` months earlier, or the month's last day if it has
 * no such day: "2026-05-31" minus 3 → "2026-02-28".
 */
export function monthsBefore(date: string, months: number): string {
  const total = Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1 - months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const day = Math.min(Number(date.slice(8, 10)), daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
