/**
 * Display formatting for numbers. Volumes and changes show as whole pounds
 * and whole percentages (rounded only for display; calculations stay
 * exact). Negative values use a true minus sign (−), which lines up with
 * tabular figures.
 */

const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** Removes "-0" so a value that rounds to zero shows as plain 0. */
function rounded(value: number): number {
  const r = Math.round(value);
  return r === 0 ? 0 : r;
}

/** A volume in lbs: 12345.6 → "12,346". */
export function formatVolume(volume: number): string {
  return whole.format(rounded(volume));
}

/** A change in lbs, signed: "+1,250", "−300", "0". */
export function formatChange(amount: number): string {
  const r = rounded(amount);
  if (r === 0) return '0';
  return `${r > 0 ? '+' : '−'}${whole.format(Math.abs(r))}`;
}

/** A change in percent, signed: "+11%", "−5%", "0%". Blank (empty) for null. */
export function formatPercent(percent: number | null): string {
  if (percent === null) return '';
  const r = rounded(percent);
  if (r === 0) return '0%';
  return `${r > 0 ? '+' : '−'}${whole.format(Math.abs(r))}%`;
}

/** A weight: up to 2 decimals, no trailing zeros: 225 → "225", 2.5 → "2.5". */
export function formatWeight(weight: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, useGrouping: false }).format(weight);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Day of the week (0 = Sunday) of a "YYYY-MM-DD" date, from the calendar alone. */
export function weekday(date: string): number {
  // Sakamoto's method: pure calendar arithmetic, no timestamps or time zones.
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  let y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  if (m < 3) y -= 1;
  return (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[m - 1]! + d) % 7;
}

/** "Fri" for a "YYYY-MM-DD" date. */
export function weekdayShort(date: string): string {
  return WEEKDAYS[weekday(date)]!;
}

/** "Nov 10", or "Nov 10, 2025" when it isn't the year of `today`. */
export function formatShortDate(date: string, today: string): string {
  const label = `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;
  return date.slice(0, 4) === today.slice(0, 4) ? label : `${label}, ${date.slice(0, 4)}`;
}

/** "Fri, Nov 13" (screens show it uppercase), with the year when it isn't this year's. */
export function formatDayDate(date: string, today: string): string {
  return `${weekdayShort(date)}, ${formatShortDate(date, today)}`;
}
