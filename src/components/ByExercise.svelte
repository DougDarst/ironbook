<script lang="ts">
  import type { LiftPeriod } from '../lib/calc';
  import { formatVolume } from '../lib/format';
  import { shortDate } from '../lib/history';
  import { versusPrevious } from '../lib/history-all';

  /**
   * "This month by exercise" (redesign Story 5): each lift's sessions,
   * volume, change vs the previous period and best session (green when it
   * was a volume PR). The lift's name switches History to it. A table on
   * laptop; a card per lift on iPhone.
   */
  let {
    lifts,
    names,
    slots,
    title,
    versusLabel,
    wide,
    onPick,
  }: {
    lifts: readonly LiftPeriod[];
    names: ReadonlyMap<string, string>;
    /** Each lift's colour slot (1–8, null for "Other"), as in the chart. */
    slots: ReadonlyMap<string, number | null>;
    /** "This month by exercise" / "Last 90 days by exercise". */
    title: string;
    /** The previous period, for the column header ("vs Oct 1–20"). */
    versusLabel: string;
    wide: boolean;
    onPick: (exercise: string) => void;
  } = $props();

  const swatch = (id: string) => (slots.get(id) ? `var(--lift-${slots.get(id)})` : 'var(--lift-other)');

  const sorted = $derived(
    [...lifts].sort((a, b) => (names.get(a.exercise) ?? '').localeCompare(names.get(b.exercise) ?? '', undefined, { sensitivity: 'base' })),
  );
</script>

<section class="card by-exercise" aria-labelledby="by-exercise-title">
  <div class="head">
    <h2 id="by-exercise-title" class="title">{title}</h2>
    <p class="muted small">Select a lift to see its full session history</p>
  </div>

  {#if sorted.length === 0}
    <p class="muted empty-note">No workouts in this period yet.</p>
  {:else if wide}
    <table>
      <colgroup>
        <col />
        <col class="c-sessions" />
        <col class="c-volume" />
        <col class="c-vs" />
        <col class="c-best" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col" class="label">Exercise</th>
          <th scope="col" class="label right">Sessions</th>
          <th scope="col" class="label right">Volume</th>
          <th scope="col" class="label right">vs {versusLabel}</th>
          <th scope="col" class="label right">Best session</th>
        </tr>
      </thead>
      <tbody>
        {#each sorted as lift (lift.exercise)}
          {@const vs = versusPrevious(lift.volume, lift.previousVolume)}
          <tr data-testid="lift-row">
            <th scope="row">
              <button type="button" class="lift" onclick={() => onPick(lift.exercise)}>
                <span class="swatch" style="background: {swatch(lift.exercise)}" aria-hidden="true"></span>{names.get(
                  lift.exercise,
                )}<span class="chevron" aria-hidden="true">›</span>
              </button>
            </th>
            <td class="right num">{lift.sessions}</td>
            <td class="right num strong">{formatVolume(lift.volume)}</td>
            <td class="right num vs {vs.trend ?? ''}">{vs.text}</td>
            <td class="right">
              <span class="best num" class:pr={lift.best.isPR}>
                {#if lift.best.isPR}<span class="pr-tag">PR</span>{/if}
                {formatVolume(lift.best.volume)}
                <span class="best-date">{shortDate(lift.best.date)}</span>
              </span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <ul class="lift-cards">
      {#each sorted as lift (lift.exercise)}
        {@const vs = versusPrevious(lift.volume, lift.previousVolume)}
        <li class="lift-card" data-testid="lift-row">
          <button type="button" class="lift" onclick={() => onPick(lift.exercise)}>
            <span class="swatch" style="background: {swatch(lift.exercise)}" aria-hidden="true"></span>{names.get(
              lift.exercise,
            )}<span class="chevron" aria-hidden="true">›</span>
          </button>
          <p class="line num">
            <span>{lift.sessions} {lift.sessions === 1 ? 'session' : 'sessions'}</span>
            <span class="strong">{formatVolume(lift.volume)}</span>
            <span class="vs {vs.trend ?? ''}">{vs.text} <span class="muted">vs {versusLabel}</span></span>
          </p>
          <p class="line">
            <span class="muted small">Best</span>
            <span class="best num" class:pr={lift.best.isPR}>
              {#if lift.best.isPR}<span class="pr-tag">PR</span>{/if}
              {formatVolume(lift.best.volume)}
              <span class="best-date">{shortDate(lift.best.date)}</span>
            </span>
          </p>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .by-exercise {
    display: grid;
    overflow: hidden;
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2) var(--space-3);
    padding: var(--space-4);
    border-bottom: 1px solid var(--line);
  }

  p,
  h2 {
    margin: 0;
  }

  .empty-note {
    padding: var(--space-4);
  }

  table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
  }

  .c-sessions {
    width: 100px;
  }

  .c-volume {
    width: 150px;
  }

  .c-vs {
    width: 150px;
  }

  .c-best {
    width: 220px;
  }

  th,
  td {
    padding: 8px var(--space-4);
    text-align: left;
    vertical-align: middle;
  }

  thead th {
    padding-top: var(--space-3);
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--line);
    background: var(--raised);
  }

  tbody tr + tr th,
  tbody tr + tr td {
    border-top: 1px solid var(--line);
  }

  .right {
    text-align: right;
  }

  .strong {
    font-weight: 700;
  }

  /* The lift's name: switches History to that lift (a 44 px target). */
  .lift {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--tap);
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    font-size: 16px;
    font-weight: 600;
    text-align: left;
  }

  .lift:hover {
    color: var(--accent);
  }

  .swatch {
    flex: none;
    width: 12px;
    height: 12px;
    border-radius: 3px;
  }

  .chevron {
    color: var(--muted);
    font-weight: 400;
  }

  .vs {
    font-weight: 600;
  }

  .vs.up {
    color: var(--up);
  }

  .vs.down {
    color: var(--down);
  }

  .best {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: 7px 12px;
    border: 1px solid transparent;
    border-radius: 9px;
    font-weight: 700;
    white-space: nowrap;
  }

  .best.pr {
    border-color: var(--pr-line);
    background: var(--pr-bg);
    color: var(--pr-ink);
  }

  .best-date {
    font-size: 12px;
    font-weight: 500;
  }

  .lift-cards {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .lift-card {
    display: grid;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-4) var(--space-3);
  }

  .lift-card + .lift-card {
    border-top: 1px solid var(--line);
  }

  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
  }
</style>
