<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import HistoryCards from './HistoryCards.svelte';
  import HistoryToolbar from './HistoryToolbar.svelte';
  import SessionsTable from './SessionsTable.svelte';
  import { listExercises, listSessions, type Exercise, type SessionEntry } from '../lib/data/logbook';
  import { buildHistory } from '../lib/history';
  import { hrefFor } from '../lib/state/router.svelte';

  /**
   * History: every finished session, grouped by exercise (oldest first),
   * with the set toggles above. On laptop, the sessions table
   * (SessionsTable); on iPhone, one compact card per session (HistoryCards).
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
    <SessionsTable {sections} />
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
</style>
