<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import HistoryCards from './HistoryCards.svelte';
  import HistoryToolbar from './HistoryToolbar.svelte';
  import SessionVolumeChart from './SessionVolumeChart.svelte';
  import SessionsTable from './SessionsTable.svelte';
  import SummaryCards from './SummaryCards.svelte';
  import { exerciseHistory, exerciseSummary } from '../lib/calc';
  import { listExercises, listSessions, type Exercise, type SessionEntry } from '../lib/data/logbook';
  import { buildHistory, exerciseSubline, summaryCards } from '../lib/history';
  import { defaultExercise } from '../lib/metrics';
  import { hrefFor } from '../lib/state/router.svelte';

  /**
   * History. Opens on the lift logged most recently: its name, summary cards
   * and volume chart, then its sessions (oldest first). "All exercises"
   * lists every exercise's sessions in sections. The set toggles sit above
   * the sessions: on laptop the sessions table (SessionsTable), on iPhone
   * one compact card per session (HistoryCards).
   */
  let exercises = $state.raw<Exercise[]>([]);
  let sessions = $state.raw<SessionEntry[]>([]);
  let loaded = $state(false);
  let error = $state(false);
  /** The exercise picked in the selector ("all" for every exercise); until then, the latest lift. */
  let chosen = $state<string | null>(null);

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
  const filter = $derived(chosen ?? defaultExercise(sessions, exercises) ?? 'all');
  const sections = $derived(filter === 'all' ? all : all.filter((s) => s.exercise.id === filter));
  /** The one exercise shown, if one is picked. */
  const single = $derived(filter === 'all' ? null : (sections[0] ?? null));
  const rows = $derived(single ? exerciseHistory(sessions, single.exercise.id) : []);
  const summary = $derived(exerciseSummary(rows));
  const points = $derived(rows.map((r) => ({ date: r.session.date, volume: r.volume, isPR: r.isPR })));
  /** The grid from 768 px up (the app's laptop layout); cards below. */
  const wide = new MediaQuery('min-width: 768px');
</script>

<section class="history" aria-label="History">
  <div class="top">
    {#if single && summary}
      <div class="heading">
        <p class="label laptop-only">History</p>
        {#if wide.current}
          <h1 class="display name">{single.exercise.name}</h1>
        {:else}
          <h2 class="display name">{single.exercise.name}</h2>
        {/if}
        <p class="muted small" data-testid="exercise-subline">{exerciseSubline(summary)}</p>
      </div>
    {:else}
      <h1 class="display laptop-only">History</h1>
    {/if}
    {#if all.length > 0}
      <label class="filter">
        <span class="label">Exercise</span>
        <select value={filter} onchange={(e) => (chosen = e.currentTarget.value)}>
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
  {:else}
    {#if single && summary}
      <SummaryCards cards={summaryCards(summary)} />
      {#key single.exercise.id}
        <SessionVolumeChart sessions={points} name={single.exercise.name} />
      {/key}
    {/if}
    <HistoryToolbar />
    {#if wide.current}
      <SessionsTable {sections} titles={!single} />
    {:else}
      <HistoryCards {sections} titles={!single} />
    {/if}
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
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .heading {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
  }

  /* The exercise's name: the page title (44 px on laptop, as in the mockup). */
  .name {
    margin: 0;
    font-size: 30px;
    text-transform: none;
    overflow-wrap: anywhere;
  }

  @media (min-width: 768px) {
    .name {
      font-size: 44px;
    }
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
