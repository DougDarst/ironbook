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
