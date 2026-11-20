<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import HistoryCards from './HistoryCards.svelte';
  import HistoryToolbar from './HistoryToolbar.svelte';
  import SetChips from './SetChips.svelte';
  import { listExercises, listSessions, type Exercise, type SessionEntry } from '../lib/data/logbook';
  import { formatChange, formatPercent, formatVolume } from '../lib/format';
  import { buildHistory, monthLabel, sheetDate } from '../lib/history';
  import { hrefFor, hrefForWorkout } from '../lib/state/router.svelte';

  /**
   * History: every finished session, grouped by exercise (oldest first). On
   * laptop, a spreadsheet-style grid like the original sheet (the header row
   * and the Date column stay pinned while scrolling); on iPhone, one compact
   * card per session (HistoryCards).
   */
  let exercises = $state.raw<Exercise[]>([]);
  let sessions = $state.raw<SessionEntry[]>([]);
  let loaded = $state(false);
  let error = $state(false);
  /** "all", or one exercise id. */
  let filter = $state('all');

  $effect(() => {
    Promise.all([listExercises(), listSessions()])
      .then(([e, s]) => {
        exercises = e;
        sessions = s;
        loaded = true;
      })
      .catch(() => (error = true));
  });

  const all = $derived(buildHistory(sessions, exercises));
  const sections = $derived(filter === 'all' ? all : all.filter((s) => s.exercise.id === filter));
  const COLUMNS = 5; // Date, Sets, Volume, Change, %
  /** The grid from 768 px up (the app's laptop layout); cards below. */
  const wide = new MediaQuery('min-width: 768px');
</script>

<section class="history" aria-labelledby="history-title">
  <div class="top">
    <h1 id="history-title" class="display laptop-only">History</h1>
    {#if all.length > 0}
      <label class="filter">
        <span class="label">Exercise</span>
        <select bind:value={filter}>
          <option value="all">All exercises</option>
          {#each all as section (section.exercise.id)}
            <option value={section.exercise.id}>{section.exercise.name}</option>
          {/each}
        </select>
      </label>
    {/if}
  </div>

  {#if error}
    <p class="notice" role="alert">Couldn't load your history. Check your connection and reload.</p>
  {:else if !loaded}
    <p class="muted" aria-live="polite">Loading…</p>
  {:else if all.length === 0}
    <div class="card empty">
      <p class="title">No workouts yet</p>
      <p class="muted">Finished workouts show up here, one row per exercise per session.</p>
      <a class="button-secondary" href={hrefFor('log')}>Log a workout</a>
    </div>
  {:else if !wide.current}
    <HistoryToolbar />
    <HistoryCards {sections} />
  {:else}
    <HistoryToolbar />
    <div class="frame" role="region" aria-label="History grid" tabindex="-1">
      <table>
        <caption class="visually-hidden">
          Finished sessions by exercise, oldest first: the sets done (pounds × reps, the warm-up ramp and repeated
          sets as set in the toolbar), the session's volume, its change from the previous session, and the change in
          percent.
        </caption>
        <thead>
          <tr>
            <th scope="col" class="date label">Date</th>
            <th scope="col" class="label sets">Sets</th>
            <th scope="col" class="label num-col">Volume</th>
            <th scope="col" class="label num-col">Change</th>
            <th scope="col" class="label num-col">%</th>
          </tr>
        </thead>
        {#each sections as section (section.exercise.id)}
          <tbody>
            <tr class="exercise">
              <th scope="rowgroup" colspan={COLUMNS}>
                <span class="pin">
                  <span class="title">{section.exercise.name}</span>
                  <span class="muted small"> · weights in lbs</span>
                </span>
              </th>
            </tr>
            {#each section.rows as row, i (row.kind === 'month' ? `m-${row.month}` : `s-${row.date}-${i}`)}
              {#if row.kind === 'month'}
                <tr class="month">
                  <td colspan={COLUMNS}>
                    <span class="pin label">{monthLabel(row.month)}</span>
                  </td>
                </tr>
              {:else}
                <tr class="session">
                  <th scope="row" class="date num">
                    <a href={hrefForWorkout(row.workout)} aria-label="Open the workout of {sheetDate(row.date)}">
                      {sheetDate(row.date)}
                    </a>
                  </th>
                  <td class="sets"><SetChips sets={row.sets} /></td>
                  <td class="num num-col volume">
                    {#if row.isPR}<span class="badge-pr">PR</span>{/if}
                    {formatVolume(row.volume)}
                  </td>
                  <td class="num num-col">{row.change ? formatChange(row.change.amount) : ''}</td>
                  <td class="num num-col">{row.change ? formatPercent(row.change.percent) : ''}</td>
                </tr>
              {/if}
            {/each}
          </tbody>
        {/each}
      </table>
    </div>
  {/if}
</section>

<style>
  .history {
    display: grid;
    gap: var(--space-4);
  }

  p {
    margin: 0;
  }

  .top {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .filter {
    display: grid;
    gap: var(--space-2);
    width: 100%;
  }

  @media (min-width: 768px) {
    .filter {
      width: min(100%, 320px);
      margin-left: auto;
    }
  }

  select {
    min-height: var(--tap);
    padding: 0 var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--surface);
    font-size: 16px;
  }

  .empty {
    display: grid;
    justify-items: start;
    gap: var(--space-3);
    padding: var(--space-6) var(--space-4);
  }

  .empty a {
    display: inline-flex;
    align-items: center;
    color: var(--ink);
    text-decoration: none;
  }

  /* The grid scrolls inside this frame both ways, so the header row and the
     Date column can stay pinned. */
  .frame {
    max-height: calc(100dvh - 220px);
    min-height: 320px;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: var(--radius-card);
    background: var(--surface);
  }

  table {
    border-collapse: separate;
    border-spacing: 0;
    min-width: 100%;
  }

  th,
  td {
    padding: 0 var(--space-3);
    white-space: nowrap;
    text-align: left;
  }

  thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    height: 48px;
    border-bottom: 1px solid var(--line);
    background: var(--raised);
  }

  /* The Sets column takes the free width; its chips wrap instead of widening the table. */
  .sets {
    width: 100%;
    min-width: 280px;
    white-space: normal;
  }

  td.sets {
    padding-top: var(--space-2);
    padding-bottom: var(--space-2);
  }

  .num-col {
    text-align: right;
  }

  /* The Date column stays put while scrolling sideways. */
  .date {
    position: sticky;
    left: 0;
    z-index: 1;
    min-width: 96px;
    border-right: 1px solid var(--line);
    background: var(--surface);
  }

  thead .date {
    z-index: 3;
    background: var(--raised);
  }

  .session th,
  .session td {
    height: 48px;
    border-bottom: 1px solid var(--line);
  }

  .date a {
    color: var(--ink);
    font-weight: 600;
    text-decoration: none;
  }

  .date a:hover {
    text-decoration: underline;
  }

  .volume {
    font-weight: 600;
  }

  .volume .badge-pr {
    margin-right: var(--space-2);
  }

  .exercise th {
    padding-top: var(--space-6);
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--line);
  }

  /* Labels in full-width rows stay in view while scrolling sideways. */
  .pin {
    position: sticky;
    left: var(--space-3);
  }

  /* Month divider: uppercase label plus a 2 px accent rule. */
  .month td {
    height: 44px;
    background-image: linear-gradient(var(--accent), var(--accent));
    background-repeat: no-repeat;
    background-position: 0 55%;
    background-size: 100% 2px;
  }

  /* The label sits on the surface colour, hiding the rule behind it, so the
     rule starts after the label (as in the mockup). */
  .month td {
    padding-left: 0;
  }

  .month .pin {
    left: 0;
    padding: 0 var(--space-3);
    background: var(--surface);
  }
</style>
