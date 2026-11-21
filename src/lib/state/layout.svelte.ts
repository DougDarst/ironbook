/**
 * Shared layout state. On iPhone, a screen with its own bottom action bar
 * ("Start workout", "Finish workout") hides the tab bar while it's shown,
 * and while a set is being typed in, the bottom bars step aside so the
 * rows above the keyboard stay visible (spec Decisions, 2026-11-20).
 */
class Layout {
  hideTabBar = $state(false);
  /** A set's weight or reps field has focus. */
  typing = $state(false);
  #stop: ReturnType<typeof setTimeout> | null = null;

  startTyping(): void {
    if (this.#stop) clearTimeout(this.#stop);
    this.#stop = null;
    this.typing = true;
  }

  /**
   * Typing stopped (a field lost focus). Waits a moment, so moving from one
   * field to the next (weight → reps) doesn't make the bars flicker.
   */
  stopTyping(): void {
    if (this.#stop) clearTimeout(this.#stop);
    this.#stop = setTimeout(() => {
      this.#stop = null;
      this.typing = false;
    }, 150);
  }
}

export const layout = new Layout();
