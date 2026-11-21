<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import AllExercisesChart from './AllExercisesChart.svelte';
  import ByExercise from './ByExercise.svelte';
  import HistoryCards from './HistoryCards.svelte';
  import HistoryToolbar from './HistoryToolbar.svelte';
  import SessionVolumeChart from './SessionVolumeChart.svelte';
  import SessionsTable from './SessionsTable.svelte';
  import SummaryCards from './SummaryCards.svelte';
  import {
    exerciseHistory,
    exerciseSummary,
    indexSeries,
    liftColorSlots,
    periodDays,
    periodSummary,
    type PeriodKind,
  } from '../lib/calc';
  import { listExercises, listSessions, type Exercise, type SessionEntry } from '../lib/data/logbook';
  import { buildHistory, exerciseSubline, summaryCards } from '../lib/history';
  import { periodCards, periodSubline, previousText } from '../lib/history-all';
  import { defaultExercise } from '../lib/metrics';
  import { localToday } from '../lib/model/dates';
  import { hrefFor } from '../lib/state/router.svelte';

  /**
   * History. Opens on the lift logged most recently: its name, summary cards
   * and volume chart, then its sessions (oldest first), with the set
   * toggles above them: on laptop the sessions table (SessionsTable), on
   * iPhone one compact card per session (HistoryCards). "All exercises"
   * sums up every lift over this month or the last 90 days: cards and a
   * by-exercise table whose names open each lift.
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

  // "All exercises": every lift over a period.
  const today = localToday();
  let period = $state<PeriodKind>('month');
  const PERIODS: { kind: PeriodKind; label: string }[] = [
    { kind: 'month', label: 'This month' },
    { kind: '90d', label: 'Last 90 days' },
  ];
  const names = $derived(new Map(exercises.map((e) => [e.id, e.name])));
  const overview = $derived(
    filter === 'all' && all.length > 0
      ? periodSummary(
          sessions,
          all.map((s) => s.exercise.id),
          period,
          today,
        )
      : null,
  );

  const liftIds = $derived(all.map((s) => s.exercise.id));
  /** Each lift's colour, by when it was first logged (it keeps it for good). */
  const slots = $derived(liftColorSlots(sessions, liftIds));
  const chartDays = $derived(overview ? periodDays(sessions, liftIds, overview.current) : []);
  const chartSeries = $derived(overview ? indexSeries(sessions, liftIds, overview.current) : []);

  /** A lift's name in the table: show that lift, from the top. */
  function pick(exercise: string) {
    chosen = exercise;
    window.scrollTo({ top: 0 });
  }
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
    {:else if overview}
      <div class="heading">
        <p class="label laptop-only">History</p>
        {#if wide.current}
          <h1 class="display name">All exercises</h1>
        {:else}
          <h2 class="display name">All exercises</h2>
        {/if}
        <p class="muted small" data-testid="period-subline">{periodSubline(overview, period)}</p>
      </div>
    {:else}
      <h1 class="display laptop-only">History</h1>
    {/if}
    {#if all.length > 0}
      <div class="controls">
        {#if overview}
          <div class="periods" role="group" aria-label="Period">
            {#each PERIODS as p (p.kind)}
              <button type="button" aria-pressed={period === p.kind} onclick={() => (period = p.kind)}>{p.label}</button>
            {/each}
          </div>
        {/if}
        <label class="filter">
          <span class="label">Exercise</span>
          <select value={filter} onchange={(e) => (chosen = e.currentTarget.value)}>
            <option value="all">All exercises</option>
            {#each all as section (section.exercise.id)}
              <option value={section.exercise.id}>{section.exercise.name}</option>
            {/each}
          </select>
        </label>
      </div>
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
  {:else if overview}
    <SummaryCards cards={periodCards(overview, period, names)} />
    <AllExercisesChart days={chartDays} series={chartSeries} period={overview.current} {names} {slots} />
    <ByExercise
      {slots}
      lifts={overview.lifts}
      {names}
      title={period === 'month' ? 'This month by exercise' : 'Last 90 days by exercise'}
      versusLabel={period === 'month' ? previousText(overview, period) : 'prev. 90 days'}
      wide={wide.current}
      onPick={pick}
    />
  {:else if single && summary}
    <SummaryCards cards={summaryCards(summary)} />
    {#key single.exercise.id}
      <SessionVolumeChart sessions={points} name={single.exercise.name} />
    {/key}
    <HistoryToolbar />
    {#if wide.current}
      <SessionsTable {sections} />
    {:else}
      <HistoryCards {sections} />
    {/if}
  {/if}
</section>

<style>
  /* One column that never grows past the screen (a chart sizes itself to it). */
  .history {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
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

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--space-3);
    width: 100%;
  }

  /* On laptop: the period switch beside the exercise selector, as in the mockup. */
  @media (min-width: 768px) {
    .controls {
      flex-wrap: nowrap;
      width: auto;
      margin-left: auto;
    }

    .controls .filter {
      width: 320px;
    }
  }

  /* This month / Last 90 days: a segmented control; the chosen one is ink-filled. */
  .periods {
    display: flex;
    max-width: 100%;
    padding: 2px;
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--raised);
  }

  .periods button {
    flex: 1 1 auto;
    min-height: var(--tap);
    padding: 0 var(--space-3);
    white-space: nowrap;
    border: 0;
    border-radius: 8px;
    background: none;
    font-size: 14px;
    font-weight: 600;
  }

  .periods button[aria-pressed='true'] {
    background: var(--ink);
    color: var(--bg);
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
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-2);
    min-width: 0;
    width: 100%;
  }

  @media (min-width: 768px) {
    .filter {
      width: min(100%, 320px);
      margin-left: auto;
    }
  }

  /* A select sizes itself to its longest option: keep it to the column. */
  select {
    width: 100%;
    min-width: 0;
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
