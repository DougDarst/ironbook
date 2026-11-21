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

/** The date of a day number (the inverse of dayNumber): 0 → "1970-01-01". */
export function dateOfDay(n: number): string {
  // Howard Hinnant's civil_from_days: pure calendar arithmetic.
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** The date `days` days after `date` (negative: before). */
export function addDays(date: string, days: number): string {
  return dateOfDay(dayNumber(date) + days);
}
