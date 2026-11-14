/**
 * Theme preference: which theme applies, and where it's remembered.
 * Pure functions, unit-tested in theme.test.ts.
 *
 * The preference is saved on the user record (so it follows you between
 * devices) and cached on the device (so the right theme shows before the
 * app has talked to the server). Demo accounts are shared, so their choice
 * is kept on the device only.
 */

export type ThemePreference = 'system' | 'light' | 'dark';

export const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/**
 * The theme to use. For a signed-in, non-demo user the saved preference wins
 * (empty means "system"). Signed out, or in a demo account, the device's
 * cached choice applies. Anything unrecognized falls back to "system".
 */
export function resolveTheme(
  user: { readonly [field: string]: unknown } | null,
  stored: unknown,
): ThemePreference {
  if (user && !user.demo) return isThemePreference(user.theme) ? user.theme : 'system';
  return isThemePreference(stored) ? stored : 'system';
}
