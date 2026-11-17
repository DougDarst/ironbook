<script lang="ts">
  import VolumeChart from './VolumeChart.svelte';
  import { exerciseHistory } from '../lib/calc';
  import { RANGES, rangeStart, type Range } from '../lib/chart';
  import { listExercises, listSessions, type Exercise, type SessionEntry } from '../lib/data/logbook';
  import { formatVolume } from '../lib/format';
  import { defaultExercise, headlineDetail } from '../lib/metrics';
  import { localToday } from '../lib/model/dates';
  import { hrefFor } from '../lib/state/router.svelte';

  /**
   * Metrics for one lift: volume per session as a line chart (3M / 1Y / All),
   * with a headline for the latest session. Opens on the lift logged most
   * recently. (Monthly totals arrive in Story 19.)
   */
  const today = localToday();
  let exercises = $state.raw<Exercise[]>([]);
  let sessions = $state.raw<SessionEntry[]>([]);
  let loaded = $state(false);
  let error = $state(false);
  let chosen = $state<string | null>(null);
  let range = $state<Range>('All');

  $effect(() => {
    Promise.all([listExercises(), listSessions()])
      .then(([e, s]) => {
        exercises = e;
        sessions = s;
        loaded = true;
      })
      .catch(() => (error = true));
  });

  /** Exercises with at least one finished session, alphabetical (listExercises sorts). */
  const logged = $derived(exercises.filter((e) => sessions.some((s) => s.exercise === e.id && s.status === 'finished')));
  const exerciseId = $derived(chosen ?? defaultExercise(sessions, exercises));
  const exercise = $derived(logged.find((e) => e.id === exerciseId) ?? null);
  const history = $derived(exercise ? exerciseHistory(sessions, exercise.id) : []);
  const latest = $derived(history.at(-1) ?? null);
  const points = $derived(history.map((h) => ({ date: h.session.date, volume: h.volume, isPR: h.isPR })));
  const inRange = $derived(
    points.length > 0 && points.some((p) => p.date >= rangeStart(range, today, points[0]!.date)),
  );
  const RANGE_NAMES: Record<Range, string> = { '3M': 'the last 3 months', '1Y': 'the last year', All: 'all time' };
</script>

<section class="metrics" aria-labelledby="metrics-title">
  <h1 id="metrics-title" class="display laptop-only">Metrics</h1>

  {#if error}
    <p class="notice" role="alert">Couldn't load your metrics. Check your connection and reload.</p>
  {:else if !loaded}
    <p class="muted" aria-live="polite">Loading…</p>
  {:else if !exercise || !latest}
    <div class="card empty">
      <p class="title">No workouts yet</p>
      <p class="muted">Charts of your lifts show up here once you finish a workout.</p>
      <a class="button-secondary" href={hrefFor('log')}>Log a workout</a>
    </div>
  {:else}
    <label class="filter">
      <span class="label">Exercise</span>
      <select value={exercise.id} onchange={(e) => (chosen = e.currentTarget.value)}>
        {#each logged as e (e.id)}
          <option value={e.id}>{e.name}</option>
        {/each}
      </select>
    </label>

    <section class="card trend" aria-labelledby="trend-title">
      <div class="top">
        <div class="headline">
          <h2 id="trend-title" class="label">Volume per session</h2>
          <p class="big num" data-testid="headline-volume">
            {formatVolume(latest.volume)}
            {#if latest.isPR}<span class="badge-pr">PR</span>{/if}
          </p>
          <p class="muted num" data-testid="headline-detail">{headlineDetail(latest, today)}</p>
        </div>
        <div class="ranges" role="group" aria-label="Range">
          {#each RANGES as r (r)}
            <button type="button" aria-pressed={range === r} onclick={() => (range = r)}>{r}</button>
          {/each}
        </div>
      </div>

      {#if inRange}
        {#key `${exercise.id}-${range}`}
          <VolumeChart sessions={points} {range} {today} name={exercise.name} />
        {/key}
        <ul class="legend small muted" aria-hidden="true">
          <li><span class="key pr"></span>Volume PR</li>
          <li><span class="key"></span>Session</li>
        </ul>
      {:else}
        <p class="muted">No {exercise.name} sessions in {RANGE_NAMES[range]}.</p>
      {/if}
    </section>
  {/if}
</section>

<style>
  .metrics {
    display: grid;
    gap: var(--space-4);
    max-width: 720px;
  }

  p,
  h2 {
    margin: 0;
  }

  .filter {
    display: grid;
    gap: var(--space-2);
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

  .trend {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-4);
  }

  /* Headline on the left (its detail line wraps), ranges top right. */
  .top {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: var(--space-3);
  }

  .headline {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
  }

  .big {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-size: 36px;
    font-weight: 600;
    line-height: 1.1;
  }

  /* 3M / 1Y / All: a segmented control; the chosen one is ink-filled. */
  .ranges {
    display: flex;
    padding: 2px;
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--raised);
  }

  .ranges button {
    min-width: var(--tap);
    min-height: var(--tap);
    padding: 0 var(--space-3);
    border: 0;
    border-radius: 8px;
    background: none;
    font-weight: 600;
  }

  .ranges button[aria-pressed='true'] {
    background: var(--ink);
    color: var(--bg);
  }

  .legend {
    display: flex;
    gap: var(--space-4);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .legend li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .key {
    width: 10px;
    height: 10px;
    border: 2px solid var(--ink);
    border-radius: 50%;
    background: var(--surface);
  }

  .key.pr {
    border-color: var(--accent);
    background: var(--accent);
  }
</style>
