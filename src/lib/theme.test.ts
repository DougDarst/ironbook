import { describe, expect, it } from 'vitest';
import { resolveTheme } from './theme';

describe('resolveTheme', () => {
  it("uses a signed-in user's saved preference over the device's", () => {
    expect(resolveTheme({ theme: 'dark', demo: false }, 'light')).toBe('dark');
    expect(resolveTheme({ theme: 'light' }, 'dark')).toBe('light');
  });

  it('treats an empty saved preference as system, ignoring the device', () => {
    expect(resolveTheme({ theme: '', demo: false }, 'dark')).toBe('system');
  });

  it("uses the device's choice for a demo account", () => {
    expect(resolveTheme({ theme: 'light', demo: true }, 'dark')).toBe('dark');
    expect(resolveTheme({ theme: 'light', demo: true }, null)).toBe('system');
  });

  it("uses the device's choice when signed out", () => {
    expect(resolveTheme(null, 'dark')).toBe('dark');
    expect(resolveTheme(null, null)).toBe('system');
  });

  it('falls back to system for anything unrecognized', () => {
    expect(resolveTheme({ theme: 'neon' }, 'dark')).toBe('system');
    expect(resolveTheme(null, 'neon')).toBe('system');
    expect(resolveTheme(null, 42)).toBe('system');
  });
});
