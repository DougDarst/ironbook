<script lang="ts">
  import { doneCount, doneVolume, plannedVolume } from '../lib/calc';
  import { formatShortDate, formatVolume } from '../lib/format';
  import type { SetSlot } from '../lib/model/sets';

  /** The current exercise at a glance: sets done, lifted, planned, last time. */
  let {
    name,
    sets,
    last,
    today,
  }: { name: string; sets: readonly SetSlot[]; last: { date: string; volume: number } | null; today: string } =
    $props();

  const lifted = $derived(doneVolume(sets));
  const planned = $derived(plannedVolume(sets));
  const progress = $derived(planned > 0 ? Math.min(1, lifted / planned) : 0);
</script>

<section class="card summary" aria-label="{name} summary">
  <div class="top">
    <h2 class="title">{name}</h2>
    <span class="muted num">{doneCount(sets)} of {sets.length} sets</span>
  </div>
  <div class="numbers">
    <div>
      <p class="label">Lifted</p>
      <p class="lifted num" data-testid="lifted">{formatVolume(lifted)}</p>
    </div>
    <div class="side muted num">
      <p data-testid="planned">Planned {formatVolume(planned)}</p>
      <p data-testid="last-time">
        {#if last}Last time ({formatShortDate(last.date, today)}) {formatVolume(last.volume)}{:else}First time{/if}
      </p>
    </div>
  </div>
  <div class="bar" aria-hidden="true"><span style="width: {progress * 100}%"></span></div>
</section>

<style>
  .summary {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-6) var(--space-6);
  }

  p,
  h2 {
    margin: 0;
  }

  .top,
  .numbers {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .numbers {
    align-items: end;
  }

  .lifted {
    font-size: 40px;
    font-weight: 600;
    line-height: 1.1;
  }

  .side {
    font-size: 15px;
    text-align: right;
    white-space: nowrap;
  }

  .bar {
    height: 8px;
    margin-top: var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--raised);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    border-radius: var(--radius-pill);
    background: var(--accent);
  }
</style>
