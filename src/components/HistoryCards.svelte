<script lang="ts">
  import ChangeCell from './ChangeCell.svelte';
  import SetChips from './SetChips.svelte';
  import VolumeCell from './VolumeCell.svelte';
  import { weekdayShort } from '../lib/format';
  import { monthLabel, monthSummaryText, sheetDate, shortDate, topSetText, type HistorySection } from '../lib/history';
  import { hrefForWorkout } from '../lib/state/router.svelte';

  /**
   * History on iPhone: one compact card per session (date, weekday and top
   * set; volume, green when a PR; change vs last time; the sets as chips),
   * under a header per month with its summary. Tapping a card opens the
   * workout: the date is the link, stretched over the card.
   */
  let { sections }: { sections: HistorySection[] } = $props();
</script>

<div class="cards">
  {#each sections as section (section.exercise.id)}
    <section class="exercise" aria-label={section.exercise.name}>
      {#each section.rows as row, i (row.kind === 'month' ? `m-${row.month}` : `s-${row.date}-${i}`)}
        {#if row.kind === 'month'}
          <div class="month">
            <h3 class="month-label">{monthLabel(row.month)}</h3>
            <span class="rule" aria-hidden="true"></span>
            <p class="month-summary muted small num">{monthSummaryText(row.summary)}</p>
          </div>
        {:else}
          <article class="card session" data-testid="history-card">
            <div class="top">
              <p class="date num">
                <a href={hrefForWorkout(row.workout)} aria-label="Open the workout of {sheetDate(row.date)}">
                  {shortDate(row.date)}
                </a>
                <span class="weekday">{weekdayShort(row.date)} · top {topSetText(row.top)}</span>
              </p>
              <div class="totals">
                <VolumeCell volume={row.volume} isPR={row.isPR} />
                <ChangeCell change={row.change} inline />
              </div>
            </div>
            <SetChips sets={row.sets} />
          </article>
        {/if}
      {/each}
    </section>
  {/each}
</div>

<style>
  .cards,
  .exercise {
    display: grid;
    gap: var(--space-3);
  }

  .cards {
    gap: var(--space-6);
  }

  p,
  h3 {
    margin: 0;
  }

  /* Month header: label and a light accent rule, the summary below. */
  .month {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: var(--space-1) var(--space-3);
    margin-top: var(--space-2);
  }

  .month-label {
    color: var(--accent);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .rule {
    height: 1px;
    background: var(--accent-line);
  }

  .month-summary {
    grid-column: 1 / -1;
  }

  .session {
    position: relative;
    display: grid;
    gap: 10px;
    padding: var(--space-3);
  }

  .top {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .date {
    font-size: 17px;
    font-weight: 600;
    line-height: 1.3;
  }

  .date a {
    color: var(--ink);
    text-decoration: none;
  }

  /* The whole card is the tap target. */
  .date a::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: var(--radius-card);
  }

  .date a:focus-visible {
    outline: none;
  }

  .date a:focus-visible::after {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
  }

  .weekday {
    display: block;
    font-size: 13px;
    font-weight: 400;
    color: var(--muted);
  }

  .totals {
    display: grid;
    justify-items: end;
    gap: 2px;
  }
</style>
