<script lang="ts">
  import { historyView } from '../lib/state/history-view.svelte';

  /**
   * History's set toggles (remembered on this device) and a key to reading
   * the chips.
   */
</script>

<div class="toolbar">
  <div class="toggles">
    <button type="button" class="toggle" aria-pressed={historyView.showRamp} onclick={() => historyView.toggleRamp()}>
      Show warm-up ramp
    </button>
    <button type="button" class="toggle" aria-pressed={historyView.grouped} onclick={() => historyView.toggleGrouped()}>
      Group repeated sets
    </button>
  </div>
  <p class="key small muted">
    <span><span class="num example">195 × 4 <strong>×5</strong></span> = five sets of 4 reps at 195 lb</span>
    <span class="top-key"><span class="swatch" aria-hidden="true"></span>Top weight that day</span>
  </p>
</div>

<style>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .toggles {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .toggle {
    min-height: var(--tap);
    padding: 0 var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--surface);
    color: var(--ink);
    font-size: 14px;
    font-weight: 600;
  }

  /* On: ink fill. */
  .toggle[aria-pressed='true'] {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--bg);
  }

  .key {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
    margin: 0;
  }

  .example strong {
    color: var(--ink);
  }

  .top-key {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .swatch {
    width: 14px;
    height: 14px;
    border: 1px solid var(--chip-top-line);
    border-radius: 4px;
    background: var(--chip-top-bg);
  }
</style>
