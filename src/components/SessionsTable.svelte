<script lang="ts">
  import ChangeCell from './ChangeCell.svelte';
  import SetChips from './SetChips.svelte';
  import VolumeCell from './VolumeCell.svelte';
  import { monthLabel, monthSummaryText, sheetDate, shortDate, topSetText, type HistorySection } from '../lib/history';
  import { hrefForWorkout } from '../lib/state/router.svelte';

  /**
   * History on laptop: the sessions table of the redesign. Columns Date |
   * Sets | Top set | Volume | Change at fixed widths, the Sets column taking
   * the rest and wrapping its chips, so the table never scrolls sideways.
   * One section per exercise (titled unless `titles` is off: the page header
   * names a single exercise), a header per month with its summary, a green
   * cell for volume PRs. The column header stays pinned as the page scrolls.
   */
  let { sections, titles = true }: { sections: HistorySection[]; titles?: boolean } = $props();
  const COLUMNS = 5;
</script>

<div class="sessions card" role="region" aria-label="Sessions">
  <table>
    <caption class="visually-hidden">
      Finished sessions by exercise, oldest first: the sets done (pounds × reps, with the warm-up ramp and repeated
      sets as chosen above), the top set, the session's volume (PR when it beat every earlier session), and the
      change from the previous session.
    </caption>
    <colgroup>
      <col class="c-date" />
      <col />
      <col class="c-top" />
      <col class="c-volume" />
      <col class="c-change" />
    </colgroup>
    <thead>
      <tr>
        <th scope="col" class="label">Date</th>
        <th scope="col" class="label">Sets</th>
        <th scope="col" class="label">Top set</th>
        <th scope="col" class="label right">Volume</th>
        <th scope="col" class="label right">Change</th>
      </tr>
    </thead>
    {#each sections as section (section.exercise.id)}
      <tbody>
        {#if titles}
          <tr class="exercise">
            <th scope="rowgroup" colspan={COLUMNS}>
              <span class="title">{section.exercise.name}</span>
              <span class="muted small"> · weights in lbs</span>
            </th>
          </tr>
        {/if}
        {#each section.rows as row, i (row.kind === 'month' ? `m-${row.month}` : `s-${row.date}-${i}`)}
          {#if row.kind === 'month'}
            <tr class="month">
              <th scope="rowgroup" colspan={COLUMNS}>
                <span class="month-head">
                  <span class="month-label">{monthLabel(row.month)}</span>
                  <span class="muted small num">{monthSummaryText(row.summary)}</span>
                  <span class="rule" aria-hidden="true"></span>
                </span>
              </th>
            </tr>
          {:else}
            <tr class="session">
              <th scope="row" class="date num">
                <a href={hrefForWorkout(row.workout)} aria-label="Open the workout of {sheetDate(row.date)}">
                  {shortDate(row.date)}
                </a>
              </th>
              <td><SetChips sets={row.sets} /></td>
              <td class="top num">{topSetText(row.top)}</td>
              <td class="right"><VolumeCell volume={row.volume} isPR={row.isPR} /></td>
              <td class="right"><ChangeCell change={row.change} /></td>
            </tr>
          {/if}
        {/each}
      </tbody>
    {/each}
  </table>
</div>

<style>
  .sessions {
    /* No overflow clipping here: the pinned header row needs the page to scroll. */
    overflow: visible;
  }

  table {
    width: 100%;
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 0;
  }

  .c-date {
    width: 96px;
  }

  .c-top {
    width: 104px;
  }

  .c-volume {
    width: 156px;
  }

  .c-change {
    width: 112px;
  }

  th,
  td {
    padding: 10px var(--space-4);
    text-align: left;
    vertical-align: middle;
  }

  .right {
    text-align: right;
  }

  /* The column header stays under the top bar while the page scrolls. */
  thead th {
    position: sticky;
    top: var(--header-height);
    z-index: 2;
    padding-top: var(--space-3);
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--line);
    background: var(--raised);
  }

  thead th:first-child {
    border-top-left-radius: var(--radius-card);
  }

  thead th:last-child {
    border-top-right-radius: var(--radius-card);
  }

  .exercise th {
    padding-top: var(--space-6);
    padding-bottom: var(--space-2);
  }

  /* Month header: label, summary, then a light accent rule to the end. */
  .month th {
    padding-top: 18px;
    padding-bottom: var(--space-2);
  }

  .month-head {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .month-label {
    color: var(--accent);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .rule {
    flex: 1;
    height: 1px;
    background: var(--accent-line);
  }

  .session th,
  .session td {
    border-bottom: 1px solid var(--line);
  }

  tbody:last-of-type .session:last-child th,
  tbody:last-of-type .session:last-child td {
    border-bottom: 0;
  }

  .date a {
    color: var(--ink);
    font-size: 16px;
    font-weight: 700;
    text-decoration: none;
  }

  .date a:hover {
    text-decoration: underline;
  }

  .top {
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
  }
</style>
