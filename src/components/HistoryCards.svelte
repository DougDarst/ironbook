<script lang="ts">
  import SetChips from './SetChips.svelte';
  import { formatChange, formatPercent, formatVolume, weekdayShort } from '../lib/format';
  import { monthLabel, sheetDate, type HistorySection } from '../lib/history';
  import { hrefForWorkout } from '../lib/state/router.svelte';

  /**
   * History on iPhone: one compact card per session (date, done sets as
   * chips, volume, change and %, PR badge), with month dividers. Tapping a
   * card opens the workout: the date is the link, stretched over the card.
   */
  let { sections }: { sections: HistorySection[] } = $props();
</script>

<div class="cards">
  {#each sections as section (section.exercise.id)}
    <section class="exercise" aria-labelledby="ex-{section.exercise.id}">
      <h2 class="title" id="ex-{section.exercise.id}">
        {section.exercise.name} <span class="unit muted small">· weights in lbs</span>
      </h2>
      {#each section.rows as row, i (row.kind === 'month' ? `m-${row.month}` : `s-${row.date}-${i}`)}
        {#if row.kind === 'month'}
          <h3 class="month label">{monthLabel(row.month)}</h3>
        {:else}
          <article class="card session" data-testid="history-card">
            <div class="top">
              <p class="date num">
                <a href={hrefForWorkout(row.workout)} aria-label="Open the workout of {sheetDate(row.date)}">
                  {sheetDate(row.date)}
                </a>
                <span class="weekday">{weekdayShort(row.date)}</span>
              </p>
              <div class="totals num">
                <p class="volume">
                  <span class="visually-hidden">Volume</span>
                  {#if row.isPR}<span class="badge-pr">PR</span>{/if}
                  {formatVolume(row.volume)}
                </p>
                <p class="change">
                  {#if row.change}
                    <span class="visually-hidden">Change</span>
                    {formatChange(row.change.amount)}{row.change.percent === null
                      ? ''
                      : ` · ${formatPercent(row.change.percent)}`}
                  {:else}
                    First session
                  {/if}
                </p>
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
  h2,
  h3 {
    margin: 0;
  }

  .unit {
    font-family: var(--font-body);
    font-weight: 400;
  }

  /* Month divider: uppercase label plus a 2 px accent rule. */
  .month {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-top: var(--space-2);
  }

  .month::after {
    content: '';
    flex: 1;
    height: 2px;
    background: var(--accent);
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

  .weekday,
  .change {
    display: block;
    font-size: 13px;
    font-weight: 400;
    color: var(--muted);
  }

  .totals {
    text-align: right;
  }

  .volume {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 17px;
    font-weight: 600;
    line-height: 1.3;
  }
</style>
