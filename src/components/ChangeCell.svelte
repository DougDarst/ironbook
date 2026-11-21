<script lang="ts">
  import type { Change } from '../lib/calc';
  import { changeText } from '../lib/history';

  /**
   * Change vs the previous session: "▲ 975" (green) or "▼ 415" (red), then
   * the percentage. The arrow carries the meaning, not only the color; the
   * first session shows "—" and "first session".
   */
  let { change, inline = false }: { change: Change | null; inline?: boolean } = $props();
  const text = $derived(changeText(change));
  const spoken = $derived(
    text.direction === 'first'
      ? 'First session'
      : `${text.direction === 'up' ? 'Up' : text.direction === 'down' ? 'Down' : 'No change,'} ${text.amount.replace(/^[▲▼] /, '')}${text.percent ? ` (${text.percent})` : ''} vs last time`,
  );
</script>

<span class="change num" class:inline data-testid="change">
  <span class="amount {text.direction}" aria-hidden="true">{text.amount}</span>
  {#if text.percent}<span class="percent" aria-hidden="true">{text.percent}</span>{/if}
  <span class="visually-hidden">{spoken}</span>
</span>

<style>
  .change {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    line-height: 1.25;
  }

  /* On the iPhone cards: one line. */
  .change.inline {
    flex-direction: row;
    align-items: baseline;
    gap: var(--space-2);
  }

  .amount {
    font-size: 15px;
    font-weight: 600;
  }

  .up {
    color: var(--up);
  }

  .down {
    color: var(--down);
  }

  .same,
  .first,
  .percent {
    color: var(--muted);
  }

  .percent {
    font-size: 12px;
  }
</style>
