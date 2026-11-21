<script lang="ts">
  import type { SummaryCardView } from '../lib/history';

  /**
   * One exercise at a glance (redesign Story 4): Latest volume, Best volume
   * (the green PR card), Heaviest top set, Volume PRs. Four across on a
   * wide screen, two by two on a phone.
   */
  let { cards }: { cards: SummaryCardView[] } = $props();
</script>

<section class="cards" aria-label="Summary">
  {#each cards as card (card.label)}
    <div class="card summary" class:pr={card.tone === 'pr'} data-testid="summary-card">
      <p class="label name">{card.label}</p>
      <p class="value num">
        {card.value}{#if card.valueSuffix}{' '}<span class="suffix">{card.valueSuffix}</span>{/if}
      </p>
      {#if card.sub}
        <!-- Keep "195 × 8 × 5" together when the line wraps. -->
        <p class="sub small num {card.trend ?? ''}">{card.sub.replaceAll(' × ', '\u00a0×\u00a0')}</p>
      {/if}
    </div>
  {/each}
</section>

<style>
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(200px, calc(50% - var(--space-2))), 1fr));
    gap: var(--space-3);
  }

  @media (min-width: 768px) {
    .cards {
      gap: var(--space-4);
    }
  }

  .summary {
    display: grid;
    align-content: start;
    gap: var(--space-1);
    min-width: 0;
    padding: var(--space-4);
  }

  p {
    margin: 0;
  }

  .value {
    font-family: var(--font-heading);
    font-size: 32px;
    font-weight: 700;
    line-height: 1.1;
  }

  .suffix {
    color: var(--muted);
    font-size: 20px;
  }

  .sub {
    color: var(--muted);
  }

  .sub.up {
    color: var(--up);
    font-weight: 600;
  }

  .sub.down {
    color: var(--down);
    font-weight: 600;
  }

  /* The best volume: the PR card. */
  .pr {
    border-color: var(--pr-line);
    background: var(--pr-bg);
  }

  .pr .name,
  .pr .value,
  .pr .sub {
    color: var(--pr-ink);
  }
</style>
