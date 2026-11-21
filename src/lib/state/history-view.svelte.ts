import type { SetView } from '../history';

/**
 * The History toolbar's toggles (show the warm-up ramp, group repeated
 * sets), remembered on this device. Defaults: ramp hidden, grouping on.
 * Storage can be unavailable (private browsing): then the choice lasts
 * until the page is reloaded.
 */
const KEY = 'history-set-view';
const DEFAULTS: SetView = { showRamp: false, grouped: true };

function read(): SetView {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<SetView> | null;
    return {
      showRamp: typeof saved?.showRamp === 'boolean' ? saved.showRamp : DEFAULTS.showRamp,
      grouped: typeof saved?.grouped === 'boolean' ? saved.grouped : DEFAULTS.grouped,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

class HistoryView {
  #view = $state<SetView>(read());

  get showRamp(): boolean {
    return this.#view.showRamp;
  }

  get grouped(): boolean {
    return this.#view.grouped;
  }

  /** The current choice, as setChips takes it. */
  get current(): SetView {
    return this.#view;
  }

  toggleRamp(): void {
    this.#set({ ...this.#view, showRamp: !this.#view.showRamp });
  }

  toggleGrouped(): void {
    this.#set({ ...this.#view, grouped: !this.#view.grouped });
  }

  #set(view: SetView): void {
    this.#view = view;
    try {
      localStorage.setItem(KEY, JSON.stringify(view));
    } catch {
      // Not saved; it still applies until the page is reloaded.
    }
  }
}

export const historyView = new HistoryView();
