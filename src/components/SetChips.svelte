<script lang="ts">
  import { chipText, setChips } from '../lib/history';
  import type { SetSlot } from '../lib/model/sets';
  import { historyView } from '../lib/state/history-view.svelte';

  /**
   * A session's sets as chips (History): the warm-up ramp (collapsed or set
   * by set), then the working sets; repeated sets grouped; the day's top
   * weight tinted. Follows the History toolbar's toggles. Wraps instead of
   * widening its column.
   */
  let { sets }: { sets: readonly SetSlot[] } = $props();

  const chips = $derived(setChips(sets, historyView.current));

  /** What a screen reader hears: "195 × 4, 5 sets", "Warm-up ramp 45→145, 11 sets", "top weight". */
  function spoken(chip: (typeof chips)[number]): string {
    const { label, extra } = chipText(chip);
    if (chip.kind === 'ramp') return `Warm-up ${label.toLowerCase()}, ${extra}`;
    const count = chip.count > 1 ? `, ${chip.count} sets` : '';
    const tone = chip.tone === 'top' ? ', top weight' : chip.tone === 'ramp' ? ', warm-up' : '';
    return `${label}${count}${tone}`;
  }
</script>

{#if chips.length > 0}
  <ul class="chips" aria-label="Sets, lbs × reps">
    {#each chips as chip, i (i)}
      {@const text = chipText(chip)}
      <li class="chip num {chip.kind === 'ramp' ? 'ramp' : chip.tone}" data-testid="set-chip">
        <span aria-hidden="true">{text.label}{#if text.extra}{' '}<span class="extra">{text.extra}</span>{/if}</span>
        <span class="visually-hidden">{spoken(chip)}</span>
      </li>
    {/each}
  </ul>
{:else}
  <span class="muted small">No sets done</span>
{/if}

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .chip {
    display: inline-flex;
    align-items: baseline;
    padding: 4px 9px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--surface);
    color: var(--ink);
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
    white-space: nowrap;
  }

  .extra {
    font-size: 12px;
    font-weight: 700;
  }

  /* Warm-up sets, muted. */
  .ramp {
    border-color: var(--chip-ramp-line);
    background: var(--chip-ramp-bg);
    color: var(--muted);
  }

  /* The day's top weight. */
  .top {
    border-color: var(--chip-top-line);
    background: var(--chip-top-bg);
    color: var(--chip-top-ink);
    font-weight: 600;
  }
</style>
