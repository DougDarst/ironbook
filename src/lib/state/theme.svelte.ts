import type { RecordModel } from 'pocketbase';
import { pb } from '../pb';
import { resolveTheme, type ThemePreference } from '../theme';

const KEY = 'theme';

function readStored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null; // storage unavailable (e.g. private mode)
  }
}

function writeStored(preference: ThemePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, preference);
  } catch {
    // not remembered on this device, but still applied
  }
}

/**
 * The theme in use (see src/lib/theme.ts for the rules). Applies it as
 * data-theme on <html>, which switches the color tokens in app.css.
 */
class Theme {
  preference = $state<ThemePreference>(resolveTheme(null, readStored()));
  error = $state<string | null>(null);

  /** Re-resolves the theme when the signed-in user changes. */
  sync(user: RecordModel | null): void {
    this.preference = resolveTheme(user, readStored());
    if (user) writeStored(this.preference);
    this.apply();
  }

  /**
   * Picks a theme: applies it at once, remembers it on this device, and
   * saves it to the user record (except for demo accounts).
   */
  async choose(preference: ThemePreference, user: RecordModel | null): Promise<void> {
    const previous = this.preference;
    this.error = null;
    this.preference = preference;
    writeStored(preference);
    this.apply();
    if (!user || user.demo) return;
    try {
      await pb.collection('users').update(user.id, { theme: preference });
    } catch {
      this.preference = previous;
      writeStored(previous);
      this.apply();
      this.error = "Couldn't save the theme. Please try again.";
    }
  }

  apply(): void {
    const root = document.documentElement;
    if (this.preference === 'system') delete root.dataset.theme;
    else root.dataset.theme = this.preference;
    updateBrowserColor(this.preference);
  }
}

/**
 * Keeps the browser's toolbar color (theme-color, used by Safari and Chrome
 * on iPhone) in step with an overridden theme. The <meta> tags in
 * index.html follow the device setting; an override pins both to the
 * current background color.
 */
function updateBrowserColor(preference: ThemePreference): void {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.dataset.original ??= meta.content;
    meta.content =
      preference === 'system' ? meta.dataset.original : getComputedStyle(document.body).backgroundColor;
  }
}

export const theme = new Theme();
