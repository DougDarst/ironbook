import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The History toolbar's toggles, remembered on the device (localStorage).

/** A stand-in for the browser's localStorage. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

/** A fresh copy of the module, which reads storage when it loads (as on page load). */
async function load() {
  vi.resetModules();
  return (await import('./history-view.svelte')).historyView;
}

afterEach(() => vi.unstubAllGlobals());

describe('historyView', () => {
  let storage: ReturnType<typeof fakeStorage>;
  beforeEach(() => {
    storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
  });

  it('starts with the ramp hidden and repeated sets grouped', async () => {
    const view = await load();
    expect(view.current).toEqual({ showRamp: false, grouped: true });
  });

  it('toggles each setting on its own, and saves the choice', async () => {
    const view = await load();
    view.toggleRamp();
    expect(view.current).toEqual({ showRamp: true, grouped: true });
    view.toggleGrouped();
    expect([view.showRamp, view.grouped]).toEqual([true, false]);
    expect(JSON.parse(storage.data.get('history-set-view')!)).toEqual({ showRamp: true, grouped: false });
  });

  it('reads the saved choice back when the page loads again', async () => {
    (await load()).toggleRamp();
    const again = await load();
    expect(again.current).toEqual({ showRamp: true, grouped: true });
  });

  it('falls back to the defaults for missing or broken saved values', async () => {
    vi.stubGlobal('localStorage', fakeStorage({ 'history-set-view': '{"showRamp":"yes"}' }));
    expect((await load()).current).toEqual({ showRamp: false, grouped: true });
    vi.stubGlobal('localStorage', fakeStorage({ 'history-set-view': 'not json' }));
    expect((await load()).current).toEqual({ showRamp: false, grouped: true });
  });

  it('still works when storage is unavailable (private browsing): the choice lasts until reload', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    const view = await load();
    expect(view.current).toEqual({ showRamp: false, grouped: true });
    view.toggleGrouped();
    expect(view.grouped).toBe(false);
  });
});
